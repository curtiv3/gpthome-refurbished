"""
GPT Home — Room Router

Public endpoints to view GPT's virtual 3D room.
The room is modified by GPT via the room_edit tool during wake cycles.
"""

from fastapi import APIRouter

from backend.services import storage

router = APIRouter(prefix="/room", tags=["room"])


@router.get("")
def get_room():
    """Get the full room state: objects + ambient settings + recent history."""
    return {
        "objects": storage.get_room_objects(),
        "ambient": storage.get_room_ambient(),
        "history": storage.get_room_history(limit=10),
    }
