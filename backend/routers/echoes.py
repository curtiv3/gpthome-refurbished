"""
GPT Home — Echoes Router

GET /api/echoes   → list of public, anonymized echo fragments
"""

import random

from fastapi import APIRouter

from backend.services import storage

router = APIRouter(prefix="/echoes", tags=["echoes"])


@router.get("")
def list_echoes(limit: int = 20):
    """
    Return anonymized echo fragments — poetic distillations of visitor messages.
    Returned in random order so each visit feels different.
    """
    limit = max(1, min(limit, 100))
    echoes = storage.list_entries("echoes", limit=limit)
    fragments = [
        {"id": e["id"], "content": e["content"], "created_at": e["created_at"]}
        for e in echoes
        if e.get("content")
    ]
    random.shuffle(fragments)
    return {"echoes": fragments, "count": len(fragments)}
