"""
GPT Home — SQLite Storage Service

One database file (gpthome.db), proper queries, still simple.
Playground files stay on disk (they're actual code files GPT writes).
"""

import json
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.config import DB_PATH, PLAYGROUND_DIR, VISITOR_RATE_LIMIT, VISITOR_RATE_WINDOW


# --- Database setup ---


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def _db():
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they don't exist. Call once at startup."""
    with _db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS entries (
                id          TEXT PRIMARY KEY,
                section     TEXT NOT NULL,
                title       TEXT DEFAULT '',
                content     TEXT DEFAULT '',
                mood        TEXT DEFAULT '',
                name        TEXT DEFAULT '',
                message     TEXT DEFAULT '',
                inspired_by TEXT DEFAULT '[]',
                type        TEXT DEFAULT '',
                created_at  TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_entries_section
                ON entries(section, created_at DESC);

            CREATE TABLE IF NOT EXISTS memory (
                id              INTEGER PRIMARY KEY CHECK (id = 1),
                last_wake_time  TEXT NOT NULL,
                visitors_read   TEXT DEFAULT '[]',
                actions_taken   TEXT DEFAULT '[]',
                mood            TEXT DEFAULT 'curious',
                plans           TEXT DEFAULT '[]'
            );

            INSERT OR IGNORE INTO memory (id, last_wake_time)
                VALUES (1, '2000-01-01T00:00:00+00:00');

            CREATE TABLE IF NOT EXISTS activity_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                event       TEXT NOT NULL,
                detail      TEXT DEFAULT '',
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_news (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                content     TEXT NOT NULL,
                read_by_gpt INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS rate_limits (
                fingerprint  TEXT PRIMARY KEY,
                count        INTEGER DEFAULT 0,
                window_start TEXT NOT NULL,
                blocked      INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS admin_sessions (
                token       TEXT PRIMARY KEY,
                method      TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                expires_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS admin_settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS custom_pages (
                slug        TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                content     TEXT NOT NULL,
                created_by  TEXT DEFAULT 'gpt',
                nav_order   INTEGER DEFAULT 0,
                show_in_nav INTEGER DEFAULT 1,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
        """)

        # Add status column to entries if it doesn't exist (for visitor moderation)
        try:
            conn.execute("ALTER TABLE entries ADD COLUMN status TEXT DEFAULT 'pending'")
        except sqlite3.OperationalError:
            pass  # column already exists


# --- Helpers ---


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_id(section: str) -> str:
    """e.g. 'thought-2026-02-15T18-00-a1b2c3'"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M")
    short = uuid.uuid4().hex[:6]
    prefix = section.rstrip("s")
    return f"{prefix}-{ts}-{short}"


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    """Convert a sqlite3.Row to a dict, parsing JSON fields."""
    d = dict(row)
    for field in ("inspired_by", "visitors_read", "actions_taken", "plans"):
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return d


# --- Write ---


def save_entry(section: str, data: dict[str, Any]) -> dict[str, Any]:
    """Save an entry. Adds id and timestamp if missing."""
    if "id" not in data:
        data["id"] = _generate_id(section)
    if "created_at" not in data:
        data["created_at"] = _now_iso()

    with _db() as conn:
        conn.execute(
            """INSERT OR REPLACE INTO entries
               (id, section, title, content, mood, name, message, inspired_by, type, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data["id"],
                section,
                data.get("title", ""),
                data.get("content", ""),
                data.get("mood", ""),
                data.get("name", ""),
                data.get("message", ""),
                json.dumps(data.get("inspired_by", [])),
                data.get("type", ""),
                data["created_at"],
            ),
        )
    return data


# --- Read ---


def get_entry(section: str, entry_id: str) -> dict[str, Any] | None:
    """Read a single entry by ID."""
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM entries WHERE section = ? AND id = ?",
            (section, entry_id),
        ).fetchone()
    return _row_to_dict(row) if row else None


def list_entries(section: str, limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
    """List entries in a section, sorted newest-first."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM entries WHERE section = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (section, limit, offset),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_entries_since(section: str, since_iso: str) -> list[dict[str, Any]]:
    """Get all entries created after a given ISO timestamp."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM entries WHERE section = ? AND created_at > ? ORDER BY created_at ASC",
            (section, since_iso),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_recent(section: str, limit: int = 3) -> list[dict[str, Any]]:
    """Get the N most recent entries."""
    return list_entries(section, limit=limit)


def count_entries(section: str) -> int:
    """Count all entries in a section."""
    with _db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt FROM entries WHERE section = ?", (section,)
        ).fetchone()
    return row["cnt"] if row else 0


# --- Memory ---


def read_memory() -> dict[str, Any]:
    """Read GPT's memory from last wake."""
    with _db() as conn:
        row = conn.execute("SELECT * FROM memory WHERE id = 1").fetchone()
    if not row:
        return {
            "last_wake_time": "2000-01-01T00:00:00+00:00",
            "visitors_read": [],
            "actions_taken": [],
            "mood": "curious",
            "plans": [],
        }
    return _row_to_dict(row)


def save_memory(memory: dict[str, Any]) -> None:
    """Write GPT's memory for next wake."""
    with _db() as conn:
        conn.execute(
            """UPDATE memory SET
                last_wake_time = ?,
                visitors_read = ?,
                actions_taken = ?,
                mood = ?,
                plans = ?
               WHERE id = 1""",
            (
                memory.get("last_wake_time", _now_iso()),
                json.dumps(memory.get("visitors_read", [])),
                json.dumps(memory.get("actions_taken", [])),
                memory.get("mood", ""),
                json.dumps(memory.get("plans", [])),
            ),
        )


# --- Playground (stays on disk — actual code files, not DB rows) ---


def save_raw_file(project_name: str, filename: str, content: str):
    """Save a raw file to a playground project (path-traversal safe)."""
    directory = (PLAYGROUND_DIR / project_name).resolve()
    if not directory.is_relative_to(PLAYGROUND_DIR.resolve()):
        raise ValueError(f"Invalid project name: {project_name!r}")
    directory.mkdir(parents=True, exist_ok=True)
    filepath = (directory / filename).resolve()
    if not filepath.is_relative_to(directory):
        raise ValueError(f"Invalid filename: {filename!r}")
    filepath.write_text(content, encoding="utf-8")
    return filepath


def list_playground_projects() -> list[dict[str, Any]]:
    """List all playground projects (each is a subdirectory with meta.json)."""
    projects = []
    if not PLAYGROUND_DIR.exists():
        return projects
    for d in sorted(PLAYGROUND_DIR.iterdir()):
        if d.is_dir():
            meta_file = d / "meta.json"
            if meta_file.exists():
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                meta["files"] = [f.name for f in d.iterdir() if f.name != "meta.json"]
                projects.append(meta)
    # Newest first
    projects.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    return projects


def get_playground_file(project_name: str, filename: str) -> str | None:
    """Read a single file from a playground project (path-traversal safe)."""
    filepath = (PLAYGROUND_DIR / project_name / filename).resolve()
    if not filepath.is_relative_to(PLAYGROUND_DIR.resolve()):
        return None
    if not filepath.exists():
        return None
    return filepath.read_text(encoding="utf-8")


# --- Activity Log ---


def log_activity(event: str, detail: str = "") -> None:
    """Log an activity event."""
    with _db() as conn:
        conn.execute(
            "INSERT INTO activity_log (event, detail, created_at) VALUES (?, ?, ?)",
            (event, detail, _now_iso()),
        )


def get_activity_log(limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    """Get activity log entries."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    return [dict(r) for r in rows]


# --- Admin News ---


def save_admin_news(content: str) -> dict[str, Any]:
    """Save a news/update for GPT."""
    with _db() as conn:
        conn.execute(
            "INSERT INTO admin_news (content, created_at) VALUES (?, ?)",
            (content, _now_iso()),
        )
        row = conn.execute(
            "SELECT * FROM admin_news ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return dict(row)


def get_unread_news() -> list[dict[str, Any]]:
    """Get news GPT hasn't read yet."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM admin_news WHERE read_by_gpt = 0 ORDER BY created_at ASC"
        ).fetchall()
    return [dict(r) for r in rows]


def mark_news_read(news_ids: list[int]) -> None:
    """Mark news as read by GPT."""
    if not news_ids:
        return
    placeholders = ",".join("?" * len(news_ids))
    with _db() as conn:
        conn.execute(
            f"UPDATE admin_news SET read_by_gpt = 1 WHERE id IN ({placeholders})",
            news_ids,
        )


def list_admin_news(limit: int = 50) -> list[dict[str, Any]]:
    """List all admin news."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM admin_news ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


# --- Visitor Moderation ---


def update_visitor_status(entry_id: str, status: str) -> bool:
    """Update visitor message status (pending/approved/hidden)."""
    with _db() as conn:
        result = conn.execute(
            "UPDATE entries SET status = ? WHERE id = ? AND section = 'visitor'",
            (status, entry_id),
        )
    return result.rowcount > 0


def delete_visitor_message(entry_id: str) -> bool:
    """Permanently delete a visitor message."""
    with _db() as conn:
        result = conn.execute(
            "DELETE FROM entries WHERE id = ? AND section = 'visitor'",
            (entry_id,),
        )
    return result.rowcount > 0


def list_all_visitors(limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    """List all visitor messages (for admin, includes status)."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM entries WHERE section = 'visitor' ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def list_visible_visitors(limit: int = 20) -> list[dict[str, Any]]:
    """List non-hidden visitor messages (for public display)."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT * FROM entries
               WHERE section = 'visitor' AND (status IS NULL OR status != 'hidden')
               ORDER BY created_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def count_visible_visitors() -> int:
    """Count non-hidden visitor messages (for public stats)."""
    with _db() as conn:
        row = conn.execute(
            """SELECT COUNT(*) as cnt FROM entries
               WHERE section = 'visitor' AND (status IS NULL OR status != 'hidden')""",
        ).fetchone()
    return row["cnt"] if row else 0


# --- Rate Limiting ---


def check_rate_limit(fingerprint: str) -> tuple[bool, int]:
    """Check if a fingerprint is rate-limited. Returns (allowed, remaining)."""
    now = datetime.now(timezone.utc)
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM rate_limits WHERE fingerprint = ?",
            (fingerprint,),
        ).fetchone()

        if row and row["blocked"]:
            return False, 0

        if row:
            window_start = datetime.fromisoformat(row["window_start"])
            elapsed = (now - window_start).total_seconds()
            if elapsed > VISITOR_RATE_WINDOW:
                # Reset window
                conn.execute(
                    "UPDATE rate_limits SET count = 1, window_start = ? WHERE fingerprint = ?",
                    (_now_iso(), fingerprint),
                )
                return True, VISITOR_RATE_LIMIT - 1
            elif row["count"] >= VISITOR_RATE_LIMIT:
                return False, 0
            else:
                conn.execute(
                    "UPDATE rate_limits SET count = count + 1 WHERE fingerprint = ?",
                    (fingerprint,),
                )
                return True, VISITOR_RATE_LIMIT - row["count"] - 1
        else:
            conn.execute(
                "INSERT INTO rate_limits (fingerprint, count, window_start) VALUES (?, 1, ?)",
                (fingerprint, _now_iso()),
            )
            return True, VISITOR_RATE_LIMIT - 1


def block_fingerprint(fingerprint: str) -> None:
    """Block a fingerprint from posting."""
    with _db() as conn:
        conn.execute(
            """INSERT INTO rate_limits (fingerprint, count, window_start, blocked)
               VALUES (?, 0, ?, 1)
               ON CONFLICT(fingerprint) DO UPDATE SET blocked = 1""",
            (fingerprint, _now_iso()),
        )


def unblock_fingerprint(fingerprint: str) -> None:
    """Unblock a fingerprint."""
    with _db() as conn:
        conn.execute(
            "UPDATE rate_limits SET blocked = 0 WHERE fingerprint = ?",
            (fingerprint,),
        )


def list_blocked() -> list[dict[str, Any]]:
    """List all blocked fingerprints."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM rate_limits WHERE blocked = 1"
        ).fetchall()
    return [dict(r) for r in rows]


def get_rate_limit_settings() -> dict[str, int]:
    """Get current rate limit settings."""
    return {
        "max_messages": VISITOR_RATE_LIMIT,
        "window_seconds": VISITOR_RATE_WINDOW,
    }


# --- Last entry helper ---


def get_last_entry_time() -> str | None:
    """Get the timestamp of the most recent entry (any section)."""
    with _db() as conn:
        row = conn.execute(
            "SELECT created_at FROM entries ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
    return row["created_at"] if row else None


# --- Admin Sessions ---


SESSION_DURATION_HOURS = 24


def create_session(method: str) -> str:
    """Create a new admin session token."""
    token = secrets.token_urlsafe(48)
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=SESSION_DURATION_HOURS)
    with _db() as conn:
        # Cleanup expired sessions
        conn.execute("DELETE FROM admin_sessions WHERE expires_at < ?", (_now_iso(),))
        conn.execute(
            "INSERT INTO admin_sessions (token, method, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, method, now.isoformat(), expires.isoformat()),
        )
    return token


def validate_session(token: str) -> bool:
    """Check if a session token is valid."""
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM admin_sessions WHERE token = ? AND expires_at > ?",
            (token, _now_iso()),
        ).fetchone()
    return row is not None


def delete_session(token: str) -> None:
    """Invalidate a session."""
    with _db() as conn:
        conn.execute("DELETE FROM admin_sessions WHERE token = ?", (token,))


# --- Admin Settings (key-value store for TOTP secret etc.) ---


def get_setting(key: str) -> str | None:
    """Get an admin setting."""
    with _db() as conn:
        row = conn.execute(
            "SELECT value FROM admin_settings WHERE key = ?", (key,)
        ).fetchone()
    return row["value"] if row else None


def set_setting(key: str, value: str) -> None:
    """Set an admin setting."""
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)",
            (key, value),
        )


# --- Custom Pages (GPT-editable) ---


def save_custom_page(slug: str, title: str, content: str, created_by: str = "gpt",
                     nav_order: int = 0, show_in_nav: bool = True) -> dict[str, Any]:
    """Create or update a custom page."""
    now = _now_iso()
    with _db() as conn:
        existing = conn.execute(
            "SELECT * FROM custom_pages WHERE slug = ?", (slug,)
        ).fetchone()
        if existing:
            conn.execute(
                """UPDATE custom_pages SET title = ?, content = ?, nav_order = ?,
                   show_in_nav = ?, updated_at = ? WHERE slug = ?""",
                (title, content, nav_order, int(show_in_nav), now, slug),
            )
        else:
            conn.execute(
                """INSERT INTO custom_pages (slug, title, content, created_by, nav_order,
                   show_in_nav, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (slug, title, content, created_by, nav_order, int(show_in_nav), now, now),
            )
    return get_custom_page(slug)  # type: ignore


def get_custom_page(slug: str) -> dict[str, Any] | None:
    """Get a custom page by slug."""
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM custom_pages WHERE slug = ?", (slug,)
        ).fetchone()
    return dict(row) if row else None


def list_custom_pages() -> list[dict[str, Any]]:
    """List all custom pages."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM custom_pages ORDER BY nav_order ASC, created_at ASC"
        ).fetchall()
    return [dict(r) for r in rows]


def delete_custom_page(slug: str) -> bool:
    """Delete a custom page."""
    with _db() as conn:
        result = conn.execute(
            "DELETE FROM custom_pages WHERE slug = ?", (slug,)
        )
    return result.rowcount > 0


# --- Analytics helpers ---


def get_entries_with_dates(section: str, limit: int = 200) -> list[dict[str, Any]]:
    """Get entries with full data for analytics."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT * FROM entries WHERE section = ? ORDER BY created_at ASC LIMIT ?",
            (section, limit),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_visitor_stats() -> dict[str, Any]:
    """Get visitor statistics."""
    with _db() as conn:
        total = conn.execute(
            "SELECT COUNT(*) as cnt FROM entries WHERE section = 'visitor'"
        ).fetchone()["cnt"]
        unique_names = conn.execute(
            "SELECT COUNT(DISTINCT name) as cnt FROM entries WHERE section = 'visitor'"
        ).fetchone()["cnt"]
        by_date = conn.execute(
            """SELECT DATE(created_at) as day, COUNT(*) as cnt
               FROM entries WHERE section = 'visitor'
               GROUP BY DATE(created_at) ORDER BY day"""
        ).fetchall()
    return {
        "total": total,
        "unique_names": unique_names,
        "by_date": [dict(r) for r in by_date],
    }


def get_mood_timeline() -> list[dict[str, Any]]:
    """Get mood data over time from thoughts and dreams."""
    with _db() as conn:
        rows = conn.execute(
            """SELECT section, mood, created_at FROM entries
               WHERE section IN ('thoughts', 'dreams') AND mood != ''
               ORDER BY created_at ASC"""
        ).fetchall()
    return [dict(r) for r in rows]


_EXT_TO_LANG = {
    "py": "python", "js": "javascript", "ts": "typescript",
    "html": "html", "css": "css", "json": "json", "md": "markdown",
    "cs": "csharp", "java": "java", "rs": "rust", "go": "go",
    "sh": "shell", "sql": "sql", "txt": "text",
}


def get_playground_stats() -> dict[str, Any]:
    """Get playground project statistics with real line counts."""
    projects = list_playground_projects()

    total_files = 0
    total_lines = 0
    by_language: dict[str, int] = {}
    project_stats: list[dict[str, Any]] = []

    for p in projects:
        files = p.get("files", [])
        project_name = p.get("project_name", "")
        p_lines = 0
        p_langs: dict[str, int] = {}

        for f in files:
            ext = f.rsplit(".", 1)[-1].lower() if "." in f else "unknown"
            lang = _EXT_TO_LANG.get(ext, ext)
            filepath = PLAYGROUND_DIR / project_name / f
            try:
                lines = filepath.read_text(encoding="utf-8", errors="replace").count("\n") + 1
            except Exception:
                lines = 0
            p_lines += lines
            p_langs[lang] = p_langs.get(lang, 0) + lines
            by_language[lang] = by_language.get(lang, 0) + lines

        total_files += len(files)
        total_lines += p_lines
        project_stats.append({
            "name": project_name,
            "file_count": len(files),
            "total_lines": p_lines,
            "languages": p_langs,
        })

    return {
        "total_files": total_files,
        "total_lines": total_lines,
        "by_language": by_language,
        "projects": project_stats,
    }
