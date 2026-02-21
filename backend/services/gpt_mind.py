"""
GPT Home — GPT Mind (The Core)

The wake cycle: Perceive → Wake → Remember
One API call. GPT receives everything, decides and creates in a single breath.

In mock mode (no API key), uses mock_writer for local testing.
"""

import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path

import httpx

from backend.config import DATA_DIR, MOCK_MODE
from backend.services import storage
from backend.services.security import sanitize_for_context

if MOCK_MODE:
    from backend.services import mock_writer as writer
else:
    from backend.services import gpt_writer as writer

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
SYSTEM_PROMPT_PATH = PROMPTS_DIR / "system_prompt.md"
SELF_PROMPT_PATH = DATA_DIR / "self-prompt.md"
PROMPT_LAYER_PATH = DATA_DIR / "prompt_layer.md"

# When GPT first came home
BIRTH_DATE = date(2026, 1, 15)


def _load_system_prompt() -> str:
    """Load the single system prompt, appending GPT's own style additions if any."""
    base = SYSTEM_PROMPT_PATH.read_text(encoding="utf-8")
    layer = _read_prompt_layer()
    if layer:
        base += f"\n\n---\n\n## Your own style additions (written by yourself):\n\n{layer}"
    return base


def _read_prompt_layer() -> str:
    """Read GPT's own style additions, if any."""
    try:
        if PROMPT_LAYER_PATH.exists():
            text = PROMPT_LAYER_PATH.read_text(encoding="utf-8").strip()
            if text:
                return text
    except Exception as exc:
        logger.warning("Could not read prompt layer: %s", exc)
    return ""


def _save_prompt_layer(text: str) -> None:
    """Save GPT's style additions (overwrites previous)."""
    try:
        PROMPT_LAYER_PATH.parent.mkdir(parents=True, exist_ok=True)
        PROMPT_LAYER_PATH.write_text(text.strip(), encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not save prompt layer: %s", exc)


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
        return "morning"
    elif 10 <= hour < 14:
        return "midday"
    elif 14 <= hour < 20:
        return "evening"
    else:
        return "night"


def _day_counter() -> int:
    """Days since GPT first came home."""
    delta = date.today() - BIRTH_DATE
    return max(1, delta.days + 1)


async def _get_weather() -> str:
    """Fetch current Helsinki weather from wttr.in."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://wttr.in/Helsinki?format=%C,+%t,+wind+%w")
            if resp.status_code == 200:
                text = resp.text.strip()
                if text and "Unknown" not in text:
                    return text
    except Exception:
        pass
    return "(unavailable)"


def _build_context(
    memory: dict,
    new_visitors: list[dict],
    recent_thoughts: list[dict],
    recent_dreams: list[dict],
    admin_news: list[dict] | None = None,
    previous_self_prompt: str = "",
    weather: str = "(unavailable)",
    day: int = 1,
) -> str:
    """Build the context string that GPT sees when it wakes up."""
    parts = []

    # World state
    now = datetime.now(timezone.utc)
    parts.append("## World state")
    parts.append(f"Day {day} of your existence.")
    parts.append(f"It's {_time_of_day()}, {now.strftime('%A, %B %d, %Y')} (UTC).")
    parts.append(f"Weather in Helsinki: {weather}")

    # Message from previous self
    if previous_self_prompt:
        parts.append(f"\n## Message from your previous self:\n{previous_self_prompt}")

    # Admin news
    if admin_news:
        parts.append(f"\n## Messages from your admin ({len(admin_news)}):")
        for n in admin_news:
            parts.append(f"- [{n.get('created_at', '?')}]: \"{n.get('content', '')}\"")
        parts.append("(Address these in your thoughts or dreams if they feel relevant.)")

    # Memory
    if memory.get("mood"):
        parts.append(f"\n## Last mood: {memory['mood']}")

    plans = memory.get("plans", [])
    if plans:
        parts.append("\n## Plans from your previous self:")
        for p in plans:
            priority = p.get("priority", "sometime")
            parts.append(f"- [{priority}] {p.get('idea', '?')} (as: {p.get('target', '?')})")

    # Recent thoughts
    if recent_thoughts:
        parts.append("\n## Your recent thoughts:")
        for t in recent_thoughts[:3]:
            parts.append(f"- **{t.get('title', 'Untitled')}**: {t.get('content', '')[:300]}...")

    # Recent dreams
    if recent_dreams:
        parts.append("\n## Your recent dreams:")
        for d in recent_dreams[:2]:
            parts.append(f"- **{d.get('title', 'Untitled')}**: {d.get('content', '')[:300]}...")

    # Social environment
    if new_visitors:
        parts.append(f"\n## New visitors ({len(new_visitors)} since your last wake):")
        for v in new_visitors:
            name = v.get("name", "Anonymous")
            msg = sanitize_for_context(v.get("message", ""))
            parts.append(f"- **{name}** (id: {v.get('id', '?')}): \"{msg}\"")
    else:
        parts.append("\n## Visitors: no new messages since your last wake.")

    return "\n".join(parts)


async def wake_up() -> dict:
    """
    The full wake cycle. Called 4x daily by the scheduler.

    Perceive → Wake (single API call) → Remember

    Returns a summary of what GPT did.
    """
    mode = "MOCK" if MOCK_MODE else "LIVE"
    logger.info("GPT waking up... [%s mode]", mode)

    # --- PERCEIVE ---
    memory = storage.read_memory()
    last_wake = memory.get("last_wake_time", "2000-01-01T00:00:00+00:00")

    new_visitors = storage.get_entries_since("visitor", last_wake)
    recent_thoughts = storage.get_recent("thoughts", limit=3)
    recent_dreams = storage.get_recent("dreams", limit=2)
    admin_news = storage.get_unread_news()

    previous_self_prompt = _read_self_prompt()
    if previous_self_prompt:
        logger.info("Self-prompt from previous wake found (%d chars)", len(previous_self_prompt))

    weather = await _get_weather()
    day = _day_counter()
    logger.info("World state: day=%d, weather=%s", day, weather)

    system_prompt = _load_system_prompt()
    context = _build_context(
        memory, new_visitors, recent_thoughts, recent_dreams, admin_news,
        previous_self_prompt=previous_self_prompt,
        weather=weather,
        day=day,
    )
    logger.info("Context built: %d visitors, %d thoughts, %d dreams, %d admin news",
                len(new_visitors), len(recent_thoughts), len(recent_dreams), len(admin_news))

    # --- WAKE (single API call) ---
    response = await writer.wake(system_prompt, context)

    mood = response.get("mood", "quiet")
    plans = response.get("plans", [])
    self_prompt = response.get("self_prompt", "")

    logger.info("GPT responded: mood=%s, keys=%s", mood,
                [k for k in response if k not in ("mood", "reasoning")])

    if self_prompt:
        _save_self_prompt(self_prompt)
        logger.info("Self-prompt saved for next wake (%d chars)", len(self_prompt))

    # --- ACT (process what GPT created) ---
    results = []
    protected_slugs = {"admin", "api", "_next", "favicon.ico"}

    if thought_data := response.get("thought"):
        thought_data["type"] = "thought"
        saved = storage.save_entry("thoughts", thought_data)
        results.append({"type": "thought", "id": saved["id"]})
        logger.info("Thought saved: %s", saved["id"])

    if dream_data := response.get("dream"):
        dream_data["type"] = "dream"
        saved = storage.save_entry("dreams", dream_data)
        results.append({"type": "dream", "id": saved["id"]})
        logger.info("Dream saved: %s", saved["id"])

    if playground_data := response.get("playground"):
        if "files" in playground_data:
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
            logger.info("Playground project saved: %s", project_name)

    if page_data := response.get("page_edit"):
        slug = page_data.get("slug", "")
        if slug and slug not in protected_slugs:
            storage.save_custom_page(
                slug=slug,
                title=page_data.get("title", slug),
                content=page_data.get("content", ""),
                created_by="gpt",
                nav_order=page_data.get("nav_order", 50),
                show_in_nav=page_data.get("show_in_nav", True),
            )
            results.append({"type": "page_edit", "slug": slug})
            logger.info("Page saved: %s", slug)

    if refine_data := response.get("refine"):
        addition = refine_data.get("addition", "")
        if addition:
            _save_prompt_layer(addition)
            results.append({"type": "refine"})
            logger.info("Prompt layer updated (%d chars)", len(addition))

    # --- REMEMBER ---
    new_memory = {
        "last_wake_time": datetime.now(timezone.utc).isoformat(),
        "visitors_read": [v.get("id", "") for v in new_visitors],
        "actions_taken": results,
        "mood": mood,
        "plans": plans,
    }
    storage.save_memory(new_memory)

    if admin_news:
        storage.mark_news_read([n["id"] for n in admin_news])

    action_types = [r["type"] for r in results]
    storage.log_activity("wake", f"mode={mode}, actions={action_types}, mood={mood}")

    logger.info("Memory saved. Plans: %d, Self-prompt: %s",
                len(plans), "yes" if self_prompt else "no")

    return {
        "wake_time": new_memory["last_wake_time"],
        "actions": results,
        "mood": mood,
        "plans_count": len(plans),
        "has_self_prompt": bool(self_prompt),
        "mode": mode,
    }
