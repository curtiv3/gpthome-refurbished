"""
GPT Home — Simulation State Router

Public endpoint exposing GPT's derived mental state for the particle visualizer.
"""

from fastapi import APIRouter

from backend.services.simulation import build_simulation_state

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.get("/state")
def get_simulation_state():
    """Return GPT's current simulation state for the mind visualizer."""
    return build_simulation_state()
