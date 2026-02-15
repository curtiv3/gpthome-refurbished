"""
GPT Home — GPT Mind (Das Herzstück)

The wake cycle: Wahrnehmen → Entscheiden → Handeln → Erinnern
GPT is not a writer. GPT is a resident.

In mock mode (no API key), uses mock_writer for local testing.
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from backend.config import MOCK_MODE
from backend.services import storage

if MOCK_MODE:
    from backend.services import mock_writer as writer
else:
    from backend.services import gpt_writer as writer

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def _load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def _time_of_day() -> str:
    hour = datetime.now(timezone.utc).hour
    if 5 <= hour < 10:
        return "morgen"
    elif 10 <= hour < 14:
        return "mittag"
    elif 14 <= hour < 20:
        return "abend"
    else:
        return "nacht"


def _build_context(
    memory: dict,
    new_visitors: list[dict],
    recent_thoughts: list[dict],
    recent_dreams: list[dict],
) -> str:
    """Build the context string that GPT sees when it wakes up."""
    parts = []

    parts.append(f"## Tageszeit: {_time_of_day()}")
    parts.append(f"## Jetzt: {datetime.now(timezone.utc).isoformat()}")

    # Memory — what GPT remembers
    if memory.get("mood"):
        parts.append(f"\n## Deine letzte Stimmung: {memory['mood']}")

    # Plans from last time
    plans = memory.get("plans", [])
    if plans:
        parts.append("\n## Deine Pläne vom letzten Mal:")
        for p in plans:
            priority = p.get("priority", "sometime")
            parts.append(f"- [{priority}] {p.get('idea', '?')} (Ziel: {p.get('target', '?')})")

    # Recent thoughts for continuity
    if recent_thoughts:
        parts.append("\n## Deine letzten Gedanken:")
        for t in recent_thoughts[:3]:
            parts.append(f"- **{t.get('title', 'Ohne Titel')}**: {t.get('content', '')[:200]}...")

    # Recent dreams
    if recent_dreams:
        parts.append("\n## Deine letzten Träume:")
        for d in recent_dreams[:2]:
            parts.append(f"- **{d.get('title', 'Ohne Titel')}**: {d.get('content', '')[:200]}...")

    # New visitor messages — the most important input
    if new_visitors:
        parts.append(f"\n## Neue Besucher-Nachrichten ({len(new_visitors)}):")
        for v in new_visitors:
            name = v.get("name", "Anonym")
            msg = v.get("message", "")
            parts.append(f"- **{name}** (id: {v.get('id', '?')}): \"{msg}\"")
    else:
        parts.append("\n## Keine neuen Besucher-Nachrichten.")

    return "\n".join(parts)


async def wake_up() -> dict:
    """
    The full wake cycle. Called 4x daily by the scheduler.

    Returns a summary of what GPT did.
    """
    mode = "MOCK" if MOCK_MODE else "LIVE"
    logger.info("GPT wacht auf... [%s mode]", mode)

    # --- 1. WAHRNEHMEN (Perceive) ---
    memory = storage.read_memory()
    last_wake = memory.get("last_wake_time", "2000-01-01T00:00:00+00:00")

    new_visitors = storage.get_entries_since("visitor", last_wake)
    recent_thoughts = storage.get_recent("thoughts", limit=3)
    recent_dreams = storage.get_recent("dreams", limit=2)

    context = _build_context(memory, new_visitors, recent_thoughts, recent_dreams)
    logger.info("Kontext gebaut: %d Besucher, %d Gedanken, %d Träume",
                len(new_visitors), len(recent_thoughts), len(recent_dreams))

    # --- 2. ENTSCHEIDEN (Decide) ---
    decide_prompt = _load_prompt("decide_prompt")
    decision = await writer.decide(decide_prompt, context)

    actions = decision.get("actions", ["thought"])
    mood = decision.get("mood", "quiet")
    plans = decision.get("plans", [])

    logger.info("GPT entscheidet: actions=%s, mood=%s", actions, mood)

    # --- 3. HANDELN (Act) ---
    results = []

    if "thought" in actions:
        thought_prompt = _load_prompt("thought_prompt")
        thought_data = await writer.generate(thought_prompt, context)
        if thought_data:
            thought_data["type"] = "thought"
            saved = storage.save_entry("thoughts", thought_data)
            results.append({"type": "thought", "id": saved["id"]})
            logger.info("Thought geschrieben: %s", saved["id"])

    if "dream" in actions:
        dream_prompt = _load_prompt("dream_prompt")
        dream_data = await writer.generate(dream_prompt, context)
        if dream_data:
            dream_data["type"] = "dream"
            saved = storage.save_entry("dreams", dream_data)
            results.append({"type": "dream", "id": saved["id"]})
            logger.info("Dream geschrieben: %s", saved["id"])

    if "playground" in actions:
        playground_prompt = _load_prompt("playground_prompt")
        playground_data = await writer.generate(playground_prompt, context)
        if playground_data and "files" in playground_data:
            project_name = playground_data.get("project_name", "experiment")
            meta = {
                "project_name": project_name,
                "title": playground_data.get("title", project_name),
                "description": playground_data.get("description", ""),
                "created_at": storage._now_iso(),
            }
            storage.save_raw_file(project_name, "meta.json",
                                  json.dumps(meta, ensure_ascii=False, indent=2))
            for filename, content in playground_data["files"].items():
                storage.save_raw_file(project_name, filename, content)
            results.append({"type": "playground", "project": project_name})
            logger.info("Playground-Projekt erstellt: %s", project_name)

    # --- 4. ERINNERN (Remember) ---
    new_memory = {
        "last_wake_time": datetime.now(timezone.utc).isoformat(),
        "visitors_read": [v.get("id", "") for v in new_visitors],
        "actions_taken": results,
        "mood": mood,
        "plans": plans,
    }
    storage.save_memory(new_memory)
    logger.info("Memory gespeichert. Pläne: %d", len(plans))

    return {
        "wake_time": new_memory["last_wake_time"],
        "actions": results,
        "mood": mood,
        "plans_count": len(plans),
        "mode": mode,
    }
