"""
GPT Home — Thoughts Router

GET  /api/thoughts          → list thoughts (newest first)
GET  /api/thoughts/{id}     → single thought
"""

from fastapi import APIRouter, HTTPException

from backend.services import storage

router = APIRouter(prefix="/thoughts", tags=["thoughts"])


@router.get("")
def list_thoughts(limit: int = 20, offset: int = 0):
    return storage.list_entries("thoughts", limit=limit, offset=offset)


@router.get("/{entry_id}")
def get_thought(entry_id: str):
    entry = storage.get_entry("thoughts", entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Thought not found")
    return entry
