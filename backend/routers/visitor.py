"""
GPT Home — Visitor Router

GET   /api/visitor          → list visitor messages
POST  /api/visitor          → leave a message
"""

from fastapi import APIRouter
from pydantic import BaseModel

from backend.services import storage

router = APIRouter(prefix="/visitor", tags=["visitor"])


class VisitorMessage(BaseModel):
    name: str = "Anonym"
    message: str


@router.get("")
def list_messages(limit: int = 50, offset: int = 0):
    return storage.list_entries("visitor", limit=limit, offset=offset)


@router.post("", status_code=201)
def leave_message(msg: VisitorMessage):
    entry = {
        "name": msg.name,
        "message": msg.message,
        "type": "visitor",
    }
    saved = storage.save_entry("visitor", entry)
    return saved
