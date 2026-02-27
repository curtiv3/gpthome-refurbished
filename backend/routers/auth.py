"""
GPT Home — Auth Router

Supports three authentication methods:
1. Admin secret key (X-Admin-Key header) — simple, always available
2. GitHub OAuth — redirect-based login
3. TOTP 2FA — authenticator app codes

All methods return a session token for subsequent API calls.
"""

import hmac
import logging
import time
from urllib.parse import urlencode, urlparse

import httpx
import pyotp
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel

from backend.config import (
    ADMIN_SECRET,
    CORS_ORIGINS,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    ADMIN_GITHUB_USERNAMES,
    TOTP_ISSUER,
)
from backend.services import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Login rate limiter (in-memory, per IP) ---

_LOGIN_WINDOW = 300          # 5 minutes
_LOGIN_MAX_ATTEMPTS = 5      # max attempts in window
_LOGIN_MAX_IPS = 1000        # max tracked IPs (prevent unbounded growth)
_login_attempts: dict[str, list[float]] = {}
_login_last_cleanup = 0.0


def _check_login_rate(request: Request):
    """Block brute-force attempts on auth endpoints."""
    global _login_last_cleanup
    ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Periodic cleanup: remove stale IPs every 60 seconds
    if now - _login_last_cleanup > 60:
        _login_last_cleanup = now
        stale = [k for k, v in _login_attempts.items()
                 if not v or now - v[-1] > _LOGIN_WINDOW]
        for k in stale:
            del _login_attempts[k]
        # Hard cap: if still over limit, drop oldest entries
        if len(_login_attempts) > _LOGIN_MAX_IPS:
            oldest = sorted(_login_attempts, key=lambda k: _login_attempts[k][-1])
            for k in oldest[:len(_login_attempts) - _LOGIN_MAX_IPS]:
                del _login_attempts[k]

    attempts = [t for t in _login_attempts.get(ip, []) if now - t < _LOGIN_WINDOW]
    if len(attempts) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Try again later.",
        )
    attempts.append(now)
    _login_attempts[ip] = attempts


# --- Models ---


class SecretKeyLogin(BaseModel):
    key: str


class TOTPVerify(BaseModel):
    code: str


# --- Shared auth dependency (used by admin routes) ---


async def require_admin_auth(
    x_admin_key: str | None = Header(None),
    authorization: str | None = Header(None),
):
    """
    Accept authentication via:
    - X-Admin-Key: <secret>  (legacy, simple)
    - Authorization: Bearer <session_token>  (OAuth/TOTP session)
    """
    # Check secret key
    if x_admin_key and hmac.compare_digest(x_admin_key, ADMIN_SECRET):
        return

    # Check session token
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        if storage.validate_session(token):
            return

    raise HTTPException(status_code=403, detail="Authentication required")


# === Secret Key Login ===


@router.post("/login", dependencies=[Depends(_check_login_rate)])
def login_with_key(data: SecretKeyLogin):
    """Login with admin secret key. Returns a session token."""
    if not hmac.compare_digest(data.key, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Invalid key")

    token = storage.create_session("secret_key")
    storage.log_activity("admin_login", "method=secret_key")
    return {"token": token, "method": "secret_key"}


# === GitHub OAuth ===


# Precompute allowed redirect hosts from CORS_ORIGINS
_ALLOWED_REDIRECT_HOSTS = {urlparse(o.strip()).netloc for o in CORS_ORIGINS if o.strip()}


@router.get("/github")
def github_login(redirect_uri: str = Query(...)):
    """Redirect to GitHub OAuth authorization page."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured")

    # Validate redirect_uri against allowed origins to prevent open redirect
    parsed = urlparse(redirect_uri)
    if parsed.netloc not in _ALLOWED_REDIRECT_HOSTS:
        raise HTTPException(status_code=400, detail="Invalid redirect URI")

    params = urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "read:user",
        "state": storage.create_session("github_pending"),
    })
    return {"url": f"https://github.com/login/oauth/authorize?{params}"}


@router.post("/github/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(...),
    redirect_uri: str = Query(""),
):
    """Exchange GitHub code for access token, verify user, return session."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="GitHub OAuth not configured")

    # Validate state against a pending session (CSRF protection)
    if not state or not storage.validate_session(state):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    storage.delete_session(state)

    # Exchange code for token (redirect_uri required when it was in the auth request)
    token_body: dict[str, str] = {
        "client_id": GITHUB_CLIENT_ID,
        "client_secret": GITHUB_CLIENT_SECRET,
        "code": code,
    }
    if redirect_uri:
        token_body["redirect_uri"] = redirect_uri

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            json=token_body,
            headers={"Accept": "application/json"},
        )
        token_data = token_res.json()

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="GitHub auth failed")

    # Get GitHub user info
    async with httpx.AsyncClient() as client:
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_data = user_res.json()

    username = user_data.get("login", "")

    # Check if user is allowed
    if ADMIN_GITHUB_USERNAMES and username not in ADMIN_GITHUB_USERNAMES:
        storage.log_activity("github_login_rejected", f"username={username}")
        raise HTTPException(status_code=403, detail="User not authorized as admin")

    # Create real session
    session_token = storage.create_session(f"github:{username}")
    storage.log_activity("admin_login", f"method=github, user={username}")
    return {"token": session_token, "method": "github", "username": username}


# === TOTP 2FA ===


@router.post("/totp/setup", dependencies=[Depends(_check_login_rate)])
def totp_setup(x_admin_key: str = Header(...)):
    """Generate TOTP secret for initial setup. Requires admin key to set up."""
    if not hmac.compare_digest(x_admin_key, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Admin key required for TOTP setup")

    existing = storage.get_setting("totp_secret")
    if existing:
        raise HTTPException(status_code=409, detail="TOTP already configured. Use /totp/reset to reconfigure.")

    secret = pyotp.random_base32()
    storage.set_setting("totp_secret", secret)

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name="admin", issuer_name=TOTP_ISSUER)

    storage.log_activity("totp_setup", "TOTP secret generated")
    return {"secret": secret, "uri": uri}


@router.post("/totp/reset", dependencies=[Depends(_check_login_rate)])
def totp_reset(x_admin_key: str = Header(...)):
    """Reset TOTP secret. Requires admin key."""
    if not hmac.compare_digest(x_admin_key, ADMIN_SECRET):
        raise HTTPException(status_code=403, detail="Admin key required")

    secret = pyotp.random_base32()
    storage.set_setting("totp_secret", secret)

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name="admin", issuer_name=TOTP_ISSUER)

    storage.log_activity("totp_reset", "TOTP secret regenerated")
    return {"secret": secret, "uri": uri}


@router.post("/totp/verify", dependencies=[Depends(_check_login_rate)])
def totp_verify(data: TOTPVerify):
    """Verify TOTP code and return session token."""
    secret = storage.get_setting("totp_secret")
    if not secret:
        raise HTTPException(status_code=501, detail="TOTP not configured")

    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=403, detail="Invalid TOTP code")

    token = storage.create_session("totp")
    storage.log_activity("admin_login", "method=totp")
    return {"token": token, "method": "totp"}


# === Session Management ===


@router.post("/validate")
def validate_token(authorization: str = Header(...)):
    """Check if a session token is still valid."""
    if authorization.startswith("Bearer "):
        token = authorization[7:]
    else:
        token = authorization

    if storage.validate_session(token):
        return {"valid": True}
    return {"valid": False}


@router.post("/logout")
def logout(authorization: str = Header(...)):
    """Invalidate the current session."""
    if authorization.startswith("Bearer "):
        token = authorization[7:]
    else:
        token = authorization

    storage.delete_session(token)
    return {"ok": True}


# === Auth Info ===


@router.get("/methods")
def available_methods():
    """List available authentication methods."""
    methods = ["secret_key"]
    if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
        methods.append("github")
    if storage.get_setting("totp_secret"):
        methods.append("totp")
    return {"methods": methods}
