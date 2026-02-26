"""
GPT Home — Dreams Router

GET  /api/dreams          → list dreams (newest first)
GET  /api/dreams/{id}     → single dream
"""

from fastapi import APIRouter, HTTPException

from backend.services import storage

router = APIRouter(prefix="/dreams", tags=["dreams"])


@router.get("")
def list_dreams(limit: int = 20, offset: int = 0):
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return storage.list_entries("dreams", limit=limit, offset=offset)


@router.get("/{entry_id}")
def get_dream(entry_id: str):
    entry = storage.get_entry("dreams", entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Dream not found")
    return entry
