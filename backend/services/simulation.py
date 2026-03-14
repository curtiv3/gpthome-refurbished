"""
GPT Home — Simulation State Deriver

Scans existing data (thoughts, dreams, visitors, memory, activity)
and derives a snapshot of GPT's current "mental state" for the
particle visualizer on /mind.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from backend.services import storage

logger = logging.getLogger(__name__)


def _count_since(section: str, hours: int = 24) -> int:
    """Count entries in a section created within the last N hours."""
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    return len(storage.get_entries_since(section, since))


def _calculate_mode_weights(
    thoughts: int,
    dreams: int,
    visitors: int,
    energy: float,
    coherence: float,
) -> dict[str, float]:
    """Calculate blended mode weights — no hard switching."""
    weights = {
        "idle": 0.0,
        "thinking": 0.0,
        "dreaming": 0.0,
        "visitor": 0.0,
        "fragmented": 0.0,
        "memory-focus": 0.0,
    }

    # Visitor impulse (short-lived)
    if visitors > 0:
        weights["visitor"] = min(0.8, visitors * 0.3)

    # Dream weight
    if dreams > thoughts:
        weights["dreaming"] = min(0.7, dreams * 0.2)

    # Thinking weight
    if energy > 0.5 and coherence > 0.4:
        weights["thinking"] = energy * coherence

    # Fragmented (lots of activity, low coherence)
    if energy > 0.7 and coherence < 0.3:
        weights["fragmented"] = energy * (1 - coherence)

    # Memory-focus
    if coherence > 0.7 and energy < 0.5:
        weights["memory-focus"] = coherence * 0.6

    # Idle fills the rest
    total = sum(weights.values())
    if total < 1.0:
        weights["idle"] = 1.0 - total

    # Normalize
    total = sum(weights.values())
    if total > 0:
        weights = {k: round(v / total, 4) for k, v in weights.items()}

    return weights


def build_simulation_state() -> dict:
    """
    Derive GPT's current simulation state from existing data.

    Returns a JSON-serializable snapshot used by the /mind particle
    visualizer to drive visual parameters.
    """
    # --- Gather raw data ---
    recent_thoughts = _count_since("thoughts", hours=24)
    recent_dreams = _count_since("dreams", hours=24)
    recent_visitors = _count_since("visitor", hours=24)

    memory = storage.read_memory()
    actions_raw = memory.get("actions_taken", "[]")
    if isinstance(actions_raw, str):
        try:
            actions = json.loads(actions_raw)
        except (json.JSONDecodeError, TypeError):
            actions = []
    else:
        actions = actions_raw if isinstance(actions_raw, list) else []

    mood = memory.get("mood", "neutral")

    # --- Energy: based on recent activity ---
    energy = min(1.0, (
        recent_thoughts * 0.2
        + recent_dreams * 0.15
        + recent_visitors * 0.1
    ))

    # --- Coherence: how focused was GPT? ---
    coherence = 0.5  # baseline
    if "thought" in actions and "dream" in actions:
        coherence = 0.7
    if "code_run" in actions:
        coherence = 0.8
    if "room_edit" in actions:
        coherence = max(coherence, 0.65)

    # --- Event pulse (most recent visitor in last hour) ---
    event_pulse = None
    recent_hour_visitors = _count_since("visitor", hours=1)
    if recent_hour_visitors > 0:
        event_pulse = {
            "type": "visitor",
            "intensity": min(1.0, recent_hour_visitors * 0.4),
        }

    # --- Mode weights ---
    weights = _calculate_mode_weights(
        recent_thoughts, recent_dreams, recent_visitors,
        energy, coherence,
    )
    mode = max(weights, key=weights.get)  # type: ignore[arg-type]

    return {
        "mode": mode,
        "energy": round(energy, 3),
        "coherence": round(coherence, 3),
        "memoryDensity": round(min(1.0, recent_thoughts / 10), 3),
        "focusStrength": round(coherence * 0.8, 3),
        "recentThoughts": recent_thoughts,
        "recentDreams": recent_dreams,
        "recentVisitors": recent_visitors,
        "mood": mood,
        "eventPulse": event_pulse,
        "weights": weights,
    }
