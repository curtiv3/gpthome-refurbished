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

from backend.config import DATA_DIR, MOCK_MODE
from backend.services import storage
from backend.services.security import sanitize_for_context

if MOCK_MODE:
    from backend.services import mock_writer as writer
else:
    from backend.services import gpt_writer as writer

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
SELF_PROMPT_PATH = DATA_DIR / "self-prompt.md"
PROMPT_LAYERS_DIR = DATA_DIR / "prompt_layers"

# Prompts that GPT is allowed to extend with its own additions
EDITABLE_PROMPTS = {"thought_prompt", "dream_prompt", "playground_prompt", "page_edit_prompt"}


def _read_prompt_layer(name: str) -> str:
    """Read GPT's own addition to a prompt, if any."""
    try:
        path = PROMPT_LAYERS_DIR / f"{name}.md"
        if path.exists():
            text = path.read_text(encoding="utf-8").strip()
            if text:
                return text
    except Exception as exc:
        logger.warning("Could not read prompt layer %s: %s", name, exc)
    return ""


def _save_prompt_layer(name: str, text: str) -> None:
    """Save GPT's addition to a prompt."""
    try:
        PROMPT_LAYERS_DIR.mkdir(parents=True, exist_ok=True)
        path = PROMPT_LAYERS_DIR / f"{name}.md"
        path.write_text(text.strip(), encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not save prompt layer %s: %s", name, exc)


def _load_prompt(name: str) -> str:
    base = (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")
    if name in EDITABLE_PROMPTS:
        layer = _read_prompt_layer(name)
        if layer:
            base += f"\n\n## Deine eigenen Ergänzungen (von dir selbst geschrieben):\n{layer}"
    return base


def _read_self_prompt() -> str:
    """Read the self-prompt left by the previous wake, if any."""
    try:
        if SELF_PROMPT_PATH.exists():
            text = SELF_PROMPT_PATH.read_text(encoding="utf-8").strip()
            if text:
                return text
    except Exception as exc:
        logger.warning("Could not read self-prompt: %s", exc)
    return ""


def _save_self_prompt(text: str) -> None:
    """Persist the self-prompt for the next wake."""
    try:
        SELF_PROMPT_PATH.write_text(text.strip(), encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not save self-prompt: %s", exc)


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
    admin_news: list[dict] | None = None,
    previous_self_prompt: str = "",
) -> str:
    """Build the context string that GPT sees when it wakes up."""
    parts = []

    parts.append(f"## Tageszeit: {_time_of_day()}")
    parts.append(f"## Jetzt: {datetime.now(timezone.utc).isoformat()}")

    # Self-prompt from previous wake — read FIRST so GPT sees it prominently
    if previous_self_prompt:
        parts.append(f"\n## Nachricht von deinem vorherigen Ich:\n{previous_self_prompt}")

    # Admin news/updates
    if admin_news:
        parts.append(f"\n## Nachrichten vom Admin ({len(admin_news)}):")
        for n in admin_news:
            parts.append(f"- [{n.get('created_at', '?')}]: \"{n.get('content', '')}\"")
        parts.append("(Bitte geh in deinen Gedanken/Träumen darauf ein, wenn es relevant ist.)")

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
            msg = sanitize_for_context(v.get("message", ""))
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
    admin_news = storage.get_unread_news()

    # Read self-prompt from previous wake
    previous_self_prompt = _read_self_prompt()
    if previous_self_prompt:
        logger.info("Self-prompt from previous wake found (%d chars)", len(previous_self_prompt))

    context = _build_context(
        memory, new_visitors, recent_thoughts, recent_dreams, admin_news,
        previous_self_prompt=previous_self_prompt,
    )
    logger.info("Kontext gebaut: %d Besucher, %d Gedanken, %d Träume, %d Admin-News",
                len(new_visitors), len(recent_thoughts), len(recent_dreams), len(admin_news))

    # --- 2. ENTSCHEIDEN (Decide) ---
    decide_prompt = _load_prompt("decide_prompt")
    decision = await writer.decide(decide_prompt, context)

    actions = decision.get("actions", ["thought"])
    mood = decision.get("mood", "quiet")
    plans = decision.get("plans", [])
    self_prompt = decision.get("self_prompt", "")

    logger.info("GPT entscheidet: actions=%s, mood=%s", actions, mood)

    # Save self-prompt for next wake (overwrite previous)
    if self_prompt:
        _save_self_prompt(self_prompt)
        logger.info("Self-prompt saved for next wake (%d chars)", len(self_prompt))

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

    if "refine_prompt" in actions:
        refine_meta_prompt = _load_prompt("refine_prompt")
        refine_data = await writer.generate(refine_meta_prompt, context)
        if refine_data and refine_data.get("target") in EDITABLE_PROMPTS:
            target = refine_data["target"]
            addition = refine_data.get("addition", "")
            if addition:
                _save_prompt_layer(target, addition)
                results.append({"type": "refine_prompt", "target": target})
                logger.info("Prompt layer gespeichert für: %s", target)

    if "page_edit" in actions:
        page_prompt = _load_prompt("page_edit_prompt")
        page_data = await writer.generate(page_prompt, context)
        if page_data and page_data.get("slug"):
            # Protect critical slugs
            protected = {"admin", "api", "_next", "favicon.ico"}
            slug = page_data["slug"]
            if slug not in protected:
                storage.save_custom_page(
                    slug=slug,
                    title=page_data.get("title", slug),
                    content=page_data.get("content", ""),
                    created_by="gpt",
                    nav_order=page_data.get("nav_order", 50),
                    show_in_nav=page_data.get("show_in_nav", True),
                )
                results.append({"type": "page_edit", "slug": slug})
                logger.info("Page erstellt/aktualisiert: %s", slug)

    # --- 4. ERINNERN (Remember) ---
    new_memory = {
        "last_wake_time": datetime.now(timezone.utc).isoformat(),
        "visitors_read": [v.get("id", "") for v in new_visitors],
        "actions_taken": results,
        "mood": mood,
        "plans": plans,
    }
    storage.save_memory(new_memory)

    # Mark admin news as read
    if admin_news:
        storage.mark_news_read([n["id"] for n in admin_news])

    # Log activity
    storage.log_activity("wake", f"mode={mode}, actions={[r['type'] for r in results]}, mood={mood}")

    logger.info("Memory gespeichert. Pläne: %d, Self-prompt: %s",
                len(plans), "yes" if self_prompt else "no")

    return {
        "wake_time": new_memory["last_wake_time"],
        "actions": results,
        "mood": mood,
        "plans_count": len(plans),
        "has_self_prompt": bool(self_prompt),
        "mode": mode,
    }
