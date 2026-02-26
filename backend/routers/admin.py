"""
GPT Home — Admin Router

Secret admin panel API. All endpoints require authentication
(secret key, GitHub OAuth session, or TOTP session).
"""

import shutil
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.config import MOCK_MODE, DATA_DIR, BASE_DIR
from backend.services import storage
from backend.services.gpt_mind import wake_up
from backend.routers.auth import require_admin_auth as require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


# --- Models ---


class NewsInput(BaseModel):
    content: str


class ModerateInput(BaseModel):
    action: str  # "approve", "hide", "delete"


class BanInput(BaseModel):
    fingerprint: str


# === Wake / Run ===


@router.post("/wake", dependencies=[Depends(require_admin)])
async def admin_wake():
    """Manually trigger a wake cycle."""
    storage.log_activity("wake", "manual trigger from admin panel")
    try:
        result = await wake_up()
        storage.log_activity("wake_complete", f"actions: {result.get('actions', [])}")
        return {"ok": True, "result": result}
    except Exception as e:
        storage.log_activity("wake_error", str(e)[:200])
        logger.exception("Wake cycle failed")
        return {"ok": False, "error": "Wake cycle failed. Check server logs."}


# === Status ===


@router.get("/status", dependencies=[Depends(require_admin)])
def admin_status():
    """Full system status for admin panel."""
    memory = storage.read_memory()

    # Check backend reachability (if we're here, it's reachable)
    backend_ok = True

    # Check Redis (not used yet, placeholder)
    redis_ok = None  # None = not configured

    # Last entry
    last_entry_time = storage.get_last_entry_time()

    self_prompt_path = DATA_DIR / "self-prompt.md"
    self_prompt = self_prompt_path.read_text(encoding="utf-8").strip() if self_prompt_path.exists() else None

    return {
        "backend_reachable": backend_ok,
        "redis_reachable": redis_ok,
        "mode": "mock" if MOCK_MODE else "live",
        "last_wake": memory.get("last_wake_time"),
        "mood": memory.get("mood"),
        "plans": memory.get("plans", []),
        "self_prompt": self_prompt,
        "last_entry_time": last_entry_time,
        "counts": {
            "thoughts": storage.count_entries("thoughts"),
            "dreams": storage.count_entries("dreams"),
            "visitor": storage.count_entries("visitor"),
        },
    }


# === News / Updates for GPT ===


@router.post("/news", dependencies=[Depends(require_admin)])
def post_news(data: NewsInput):
    """Write news/update that GPT will read on next wake."""
    saved = storage.save_admin_news(data.content)
    storage.log_activity("news_posted", data.content[:100])
    return {"ok": True, "news": saved}


@router.get("/news", dependencies=[Depends(require_admin)])
def list_news():
    """List all admin news."""
    return storage.list_admin_news()


# === Visitor Moderation ===


@router.get("/visitors", dependencies=[Depends(require_admin)])
def list_visitors(limit: int = 100, offset: int = 0):
    """List all visitor messages with moderation status."""
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    return storage.list_all_visitors(limit=limit, offset=offset)


@router.patch("/visitors/{entry_id}", dependencies=[Depends(require_admin)])
def moderate_visitor(entry_id: str, data: ModerateInput):
    """Moderate a visitor message (approve/hide/delete)."""
    if data.action == "delete":
        ok = storage.delete_visitor_message(entry_id)
        if ok:
            storage.log_activity("visitor_deleted", entry_id)
        return {"ok": ok}
    elif data.action in ("approve", "hide"):
        ok = storage.update_visitor_status(entry_id, data.action)
        if ok:
            storage.log_activity(f"visitor_{data.action}", entry_id)
        return {"ok": ok}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/visitors/ban", dependencies=[Depends(require_admin)])
def ban_visitor(data: BanInput):
    """Ban a fingerprint from posting."""
    storage.block_fingerprint(data.fingerprint)
    storage.log_activity("visitor_banned", data.fingerprint)
    return {"ok": True}


@router.post("/visitors/unban", dependencies=[Depends(require_admin)])
def unban_visitor(data: BanInput):
    """Unban a fingerprint."""
    storage.unblock_fingerprint(data.fingerprint)
    storage.log_activity("visitor_unbanned", data.fingerprint)
    return {"ok": True}


@router.get("/visitors/blocked", dependencies=[Depends(require_admin)])
def list_blocked_visitors():
    """List all blocked fingerprints."""
    return storage.list_blocked()


# === Backups ===


@router.post("/backup", dependencies=[Depends(require_admin)])
def create_backup():
    """Create a snapshot (zip of data directory)."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = BASE_DIR / "backups"
    backup_dir.mkdir(exist_ok=True)
    backup_name = f"gpthome-backup-{ts}"
    backup_path = backup_dir / backup_name

    shutil.make_archive(str(backup_path), "zip", str(DATA_DIR))

    storage.log_activity("backup_created", f"{backup_name}.zip")
    return {"ok": True, "filename": f"{backup_name}.zip"}


@router.get("/backups", dependencies=[Depends(require_admin)])
def list_backups():
    """List existing backups."""
    backup_dir = BASE_DIR / "backups"
    if not backup_dir.exists():
        return []
    backups = []
    for f in sorted(backup_dir.iterdir(), reverse=True):
        if f.suffix == ".zip":
            backups.append({
                "filename": f.name,
                "size_mb": round(f.stat().st_size / (1024 * 1024), 2),
                "created": datetime.fromtimestamp(
                    f.stat().st_mtime, tz=timezone.utc
                ).isoformat(),
            })
    return backups


# === Activity Timeline ===


@router.get("/activity", dependencies=[Depends(require_admin)])
def activity_timeline(limit: int = 50, offset: int = 0):
    """Activity timeline — chronological events."""
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    return storage.get_activity_log(limit=limit, offset=offset)


# === Rate Limit Controls ===


@router.get("/rate-limits", dependencies=[Depends(require_admin)])
def rate_limit_info():
    """Get rate limit settings and blocked list."""
    return {
        "settings": storage.get_rate_limit_settings(),
        "blocked": storage.list_blocked(),
    }
