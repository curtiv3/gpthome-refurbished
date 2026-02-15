"""
GPT Home — File-based Storage Service

Each entry is a single JSON file. Simple, browsable, backupable.
"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.config import (
    DREAMS_DIR,
    MEMORY_DIR,
    PLAYGROUND_DIR,
    THOUGHTS_DIR,
    VISITOR_DIR,
)

SECTION_DIRS: dict[str, Path] = {
    "thoughts": THOUGHTS_DIR,
    "dreams": DREAMS_DIR,
    "playground": PLAYGROUND_DIR,
    "visitor": VISITOR_DIR,
    "memory": MEMORY_DIR,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_id(section: str) -> str:
    """e.g. 'thought-2026-02-15T18-00-a1b2c3'"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M")
    short = uuid.uuid4().hex[:6]
    prefix = section.rstrip("s")  # thoughts -> thought
    return f"{prefix}-{ts}-{short}"


def _get_dir(section: str) -> Path:
    if section not in SECTION_DIRS:
        raise ValueError(f"Unknown section: {section}")
    return SECTION_DIRS[section]


# --- Write ---


def save_entry(section: str, data: dict[str, Any]) -> dict[str, Any]:
    """Save an entry to a section. Adds id and timestamp if missing."""
    directory = _get_dir(section)

    if "id" not in data:
        data["id"] = _generate_id(section)
    if "created_at" not in data:
        data["created_at"] = _now_iso()

    filepath = directory / f"{data['id']}.json"
    filepath.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


def save_raw_file(section: str, project_name: str, filename: str, content: str) -> Path:
    """Save a raw file (for playground projects)."""
    directory = _get_dir(section) / project_name
    directory.mkdir(parents=True, exist_ok=True)
    filepath = directory / filename
    filepath.write_text(content, encoding="utf-8")
    return filepath


# --- Read ---


def get_entry(section: str, entry_id: str) -> dict[str, Any] | None:
    """Read a single entry by ID."""
    filepath = _get_dir(section) / f"{entry_id}.json"
    if not filepath.exists():
        return None
    return json.loads(filepath.read_text(encoding="utf-8"))


def list_entries(
    section: str,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """List entries in a section, sorted newest-first."""
    directory = _get_dir(section)
    files = sorted(directory.glob("*.json"), reverse=True)
    entries = []
    for f in files[offset : offset + limit]:
        entries.append(json.loads(f.read_text(encoding="utf-8")))
    return entries


def get_entries_since(section: str, since_iso: str) -> list[dict[str, Any]]:
    """Get all entries created after a given ISO timestamp."""
    since = datetime.fromisoformat(since_iso)
    entries = []
    for f in sorted(_get_dir(section).glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        created = datetime.fromisoformat(data.get("created_at", "2000-01-01T00:00:00"))
        if created > since:
            entries.append(data)
    return entries


def get_recent(section: str, limit: int = 3) -> list[dict[str, Any]]:
    """Get the N most recent entries."""
    return list_entries(section, limit=limit)


# --- Memory (special: single file, not per-entry) ---


MEMORY_FILE = MEMORY_DIR / "last_wake.json"


def read_memory() -> dict[str, Any]:
    """Read GPT's memory from last wake."""
    if not MEMORY_FILE.exists():
        return {
            "last_wake_time": "2000-01-01T00:00:00+00:00",
            "visitors_read": [],
            "actions_taken": [],
            "mood": "curious",
            "plans": [],
        }
    return json.loads(MEMORY_FILE.read_text(encoding="utf-8"))


def save_memory(memory: dict[str, Any]) -> None:
    """Write GPT's memory for next wake."""
    MEMORY_FILE.write_text(
        json.dumps(memory, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# --- Playground helpers ---


def list_playground_projects() -> list[dict[str, Any]]:
    """List all playground projects (each is a subdirectory with meta.json)."""
    projects = []
    for d in sorted(PLAYGROUND_DIR.iterdir()):
        if d.is_dir():
            meta_file = d / "meta.json"
            if meta_file.exists():
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                meta["files"] = [f.name for f in d.iterdir() if f.name != "meta.json"]
                projects.append(meta)
    return projects


def get_playground_file(project_name: str, filename: str) -> str | None:
    """Read a single file from a playground project."""
    filepath = PLAYGROUND_DIR / project_name / filename
    if not filepath.exists():
        return None
    return filepath.read_text(encoding="utf-8")
