"""
GPT Home — Visitor Router

GET   /api/visitor          → count only (messages are private)
POST  /api/visitor          → leave a message (rate-limited)
"""

import hashlib

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from backend.services import storage
from backend.services.echo import generate_echo
from backend.services.security import check_message

router = APIRouter(prefix="/visitor", tags=["visitor"])


class VisitorMessage(BaseModel):
    name: str = "Anonym"
    message: str


def _get_fingerprint(request: Request) -> str:
    """Create a hash from IP + user agent for rate limiting."""
    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    raw = f"{ip}:{ua}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


@router.get("")
def list_messages():
    """Public endpoint: only returns message count (messages are private)."""
    count = storage.count_entries("visitor")
    return {
        "count": count,
        "note": "Messages are read by GPT, not displayed publicly.",
    }


@router.post("", status_code=201)
def leave_message(msg: VisitorMessage, request: Request, background_tasks: BackgroundTasks):
    """Leave a message. Rate-limited by IP fingerprint."""
    fingerprint = _get_fingerprint(request)

    # Security check — block prompt injection attempts
    is_safe, reason = check_message(msg.message)
    if not is_safe:
        storage.log_activity("injection_blocked", f"reason={reason}, fp={fingerprint}, preview={msg.message[:60]}")
        # Auto-block repeat offenders
        if reason in ("credential_extraction", "code_execution", "sql_injection", "jailbreak"):
            storage.block_fingerprint(fingerprint)
            storage.log_activity("auto_blocked", f"fingerprint={fingerprint}, reason={reason}")
        raise HTTPException(
            status_code=400,
            detail="Message could not be processed.",
        )

    # Also check the name field
    name_safe, _ = check_message(msg.name) if msg.name.strip() else (True, "ok")
    if not name_safe:
        raise HTTPException(status_code=400, detail="Invalid name.")

    allowed, remaining = storage.check_rate_limit(fingerprint)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Too many messages. Please wait before sending another.",
        )

    entry = {
        "name": msg.name.strip() or "Anonym",
        "message": msg.message.strip(),
        "type": "visitor",
        "status": "pending",
    }
    saved = storage.save_entry("visitor", entry)
    storage.log_activity("visitor_message", f"{entry['name']}: {entry['message'][:60]}")
    background_tasks.add_task(generate_echo, saved["id"], entry["message"])
    return {"id": saved["id"], "name": saved["name"], "remaining": remaining}
