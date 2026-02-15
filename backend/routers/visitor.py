"""
GPT Home — Visitor Router

GET   /api/visitor          → count only (messages are private)
POST  /api/visitor          → leave a message (rate-limited)
"""

import hashlib

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from backend.services import storage

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
def leave_message(msg: VisitorMessage, request: Request):
    """Leave a message. Rate-limited by IP fingerprint."""
    fingerprint = _get_fingerprint(request)

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
    return {"id": saved["id"], "name": saved["name"], "remaining": remaining}
