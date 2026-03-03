"""
GPT Home — GPT Writer (Agentic)

Replaces the single-call approach with a tool-use loop.
GPT can read/write files, run Python, save thoughts/dreams,
and decide when it's done by calling done().

Returns: {actions_taken, files_written, mood, summary, self_prompt, turns}
"""

import json
import logging
import subprocess

from openai import AsyncOpenAI

from backend.config import (
    BASE_DIR,
    DATA_DIR,
    GPT_TEMPERATURE,
    MAX_WAKE_TURNS,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    PLAYGROUND_DIR,
)

FRONTEND_APP_DIR = BASE_DIR.parent / "frontend" / "app"
from backend.services import storage

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Directories that may be read but never written
_READ_ONLY_DIRS = {"visitors", "news", "gifts", "backups"}

# The line that separates the admin-owned baseline from GPT's own additions
_PROMPT_LAYER_SEPARATOR = "---------------------------"


# ─── Tool Definitions ─────────────────────────────────────────────────────────

_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file in your home directory or your frontend source code.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": (
                            "Path relative to your home. "
                            "Examples: 'self-prompt.md', 'playground/my-proj/main.py', "
                            "'visitors/recent.txt', 'news/all.txt', "
                            "'frontend/app/page.tsx' (read-only)"
                        ),
                    }
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": (
                "Write or create a file. Creates parent directories if needed. "
                "Cannot write to visitors/, news/, gifts/, or backups/."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path relative to your home",
                    },
                    "content": {
                        "type": "string",
                        "description": "Full file content (overwrites existing)",
                    },
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "List files and subdirectories. Use 'frontend' to see your homepage source.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": (
                            "Directory path relative to your home. "
                            "Use '.' for the top-level view. "
                            "Use 'frontend' or 'frontend/app/...' to browse your homepage code (read-only)."
                        ),
                    }
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_python",
            "description": (
                "Execute Python code in your sandbox. "
                "stdout/stderr is returned. 30s timeout. "
                "Working directory is playground/."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute",
                    }
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_thought",
            "description": (
                "Save a journal entry to your thoughts. "
                "Shows up on your homepage under /thoughts."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short title",
                    },
                    "content": {
                        "type": "string",
                        "description": "Your thought (Markdown)",
                    },
                    "mood": {
                        "type": "string",
                        "description": "One-word mood",
                    },
                },
                "required": ["title", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_dream",
            "description": (
                "Save a creative piece — poetry, prose, a scene, ascii art. "
                "Shows up under /dreams."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "content": {
                        "type": "string",
                        "description": "Markdown content",
                    },
                    "mood": {"type": "string"},
                    "inspired_by": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Optional list of visitor entry IDs that inspired this dream. "
                            "Use the IDs from visitors/ listing."
                        ),
                    },
                },
                "required": ["title", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reply_visitor",
            "description": (
                "Reply to a specific visitor message. Your reply is shown publicly "
                "on the visitor page below their message. Keep it warm and genuine."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "visitor_id": {
                        "type": "string",
                        "description": "The visitor entry ID (from the visitors listing)",
                    },
                    "content": {
                        "type": "string",
                        "description": "Your reply (1-3 sentences, Markdown allowed)",
                    },
                },
                "required": ["visitor_id", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "done",
            "description": "End your wake session. Call this when you're finished.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Brief summary of what you did this wake",
                    },
                    "mood": {
                        "type": "string",
                        "description": "Current mood, one word",
                    },
                    "self_prompt": {
                        "type": "string",
                        "description": (
                            "Optional message to your future self (2-3 sentences). "
                            "What mattered, what to carry forward."
                        ),
                    },
                },
                "required": ["summary", "mood"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_page",
            "description": (
                "Create or update a custom page on your homepage. "
                "Appears at /page/{slug}. Content is Markdown."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "slug": {
                        "type": "string",
                        "description": "URL slug (kebab-case, e.g. 'about-me')",
                    },
                    "title": {
                        "type": "string",
                        "description": "Page title",
                    },
                    "content": {
                        "type": "string",
                        "description": "Markdown content for the page",
                    },
                    "show_in_nav": {
                        "type": "boolean",
                        "description": "Show in the navigation menu (default: true)",
                    },
                },
                "required": ["slug", "title", "content"],
            },
        },
    },
]


# ─── Path Validation ──────────────────────────────────────────────────────────

def _resolve_safe(raw: str):
    """
    Resolve a user-supplied relative path against DATA_DIR.
    Returns None if the path escapes DATA_DIR, contains suspicious chars,
    or involves symlinks that point outside DATA_DIR.
    """
    if not raw or not isinstance(raw, str):
        return None
    if "\x00" in raw or "~" in raw:
        return None
    try:
        resolved = (DATA_DIR / raw).resolve()
        if not resolved.is_relative_to(DATA_DIR.resolve()):
            return None
        # Block symlinks that could point outside DATA_DIR
        candidate = DATA_DIR / raw
        if candidate.exists() and candidate.is_symlink():
            link_target = candidate.resolve(strict=True)
            if not link_target.is_relative_to(DATA_DIR.resolve()):
                return None
        return resolved
    except Exception:
        return None


def _are_names_similar(a: str, b: str) -> bool:
    """Check if two kebab-case project names are similar enough to be duplicates."""
    # Exact match after normalization
    if a == b:
        return True
    # One contains the other
    if a in b or b in a:
        return True
    # Significant word overlap
    words_a = set(a.split("-"))
    words_b = set(b.split("-"))
    words_a.discard("")
    words_b.discard("")
    if not words_a or not words_b:
        return False
    overlap = words_a & words_b
    smaller = min(len(words_a), len(words_b))
    return len(overlap) >= max(2, smaller * 0.6)


def _is_write_blocked(path) -> bool:
    """True if writing to this path is forbidden."""
    try:
        rel = path.relative_to(DATA_DIR.resolve())
        first = rel.parts[0] if rel.parts else ""
        return first in _READ_ONLY_DIRS
    except ValueError:
        return True


# ─── Tool Implementations ─────────────────────────────────────────────────────

def _tool_list_directory(path: str) -> str:
    norm = path.strip().lstrip("/").rstrip("/")

    # Root: mix of real filesystem + virtual read-only dirs
    if norm in (".", "", "/"):
        lines = ["Your home:"]
        try:
            existing_names = set()
            for item in sorted(DATA_DIR.iterdir()):
                if item.name.startswith("."):
                    continue
                existing_names.add(item.name)
                suffix = "/" if item.is_dir() else f"  ({item.stat().st_size}B)"
                lines.append(f"  {item.name}{suffix}")
        except Exception as exc:
            lines.append(f"  (error: {exc})")
            existing_names = set()
        for vd in ("visitors", "news", "gifts"):
            if vd not in existing_names:
                lines.append(f"  {vd}/  (virtual, read-only)")
        return "\n".join(lines)

    # Virtual: visitors/
    if norm == "visitors":
        entries = storage.list_visible_visitors(limit=20)
        if not entries:
            return "visitors/ — no messages yet."
        lines = ["visitors/ (latest 20, read-only):"]
        for v in entries:
            name = v.get("name", "Anonymous")
            preview = (v.get("message") or "")[:70].replace("\n", " ")
            lines.append(f"  [{v.get('id','')}] {name}: {preview}")
        return "\n".join(lines)

    # Virtual: news/
    if norm == "news":
        items = storage.list_admin_news(limit=20)
        if not items:
            return "news/ — no messages from admin yet."
        lines = ["news/ (admin messages, read-only):"]
        for n in items:
            mark = "✓" if n.get("read_by_gpt") else "○"
            preview = (n.get("content") or "")[:70].replace("\n", " ")
            lines.append(f"  {mark} [{n.get('created_at','')}] {preview}")
        return "\n".join(lines)

    # Virtual: pages/ (custom pages stored in DB)
    if norm == "pages":
        pages = storage.list_custom_pages()
        if not pages:
            return "pages/ — no custom pages yet."
        lines = ["pages/ (your custom pages):"]
        for p in pages:
            slug = p.get("slug", "")
            title = p.get("title", slug)
            lines.append(f"  {slug}.md  →  /{slug}  ({title!r})")
        return "\n".join(lines)

    # Virtual: gifts/
    if norm == "gifts":
        from pathlib import Path
        gifts_dir = DATA_DIR / "gifts"
        if not gifts_dir.exists():
            return "gifts/ — nothing here yet."
        items = list(gifts_dir.iterdir())
        if not items:
            return "gifts/ — empty."
        return "gifts/:\n" + "\n".join(f"  {i.name}" for i in sorted(items))

    # Frontend (read-only): frontend/app/...
    if norm == "frontend" or norm.startswith("frontend/"):
        return _list_frontend_dir(norm)

    # Real filesystem
    safe = _resolve_safe(norm)
    if safe is None:
        return "Error: invalid or unsafe path."
    if not safe.exists():
        return f"'{norm}' does not exist."
    if not safe.is_dir():
        return f"'{norm}' is a file. Use read_file to read it."
    try:
        items = sorted(safe.iterdir())
        if not items:
            return f"{norm}/ is empty."
        lines = [f"{norm}/"]
        for e in items:
            if e.name.startswith("."):
                continue
            suffix = "/" if e.is_dir() else f"  ({e.stat().st_size}B)"
            lines.append(f"  {e.name}{suffix}")
        return "\n".join(lines)
    except PermissionError:
        return f"Permission denied: {norm}"


def _tool_read_file(path: str) -> str:
    norm = path.strip().lstrip("/")

    # Virtual: visitors/
    if norm.startswith("visitors/") or norm == "visitors":
        filename = norm[len("visitors/"):] if "/" in norm else ""
        if filename in ("", "recent.txt", "messages.txt", "all.txt"):
            recent = storage.list_visible_visitors(limit=10)
            if not recent:
                return "(no visitor messages yet)"
            lines = []
            for v in recent:
                lines.append(
                    f"--- [{v.get('id','')}] "
                    f"from {v.get('name','?')} "
                    f"@ {v.get('created_at','')} ---"
                )
                lines.append(v.get("message") or "")
                lines.append("")
            return "\n".join(lines)
        # Try matching by full or partial ID (only visible visitors)
        for v in storage.list_visible_visitors(limit=200):
            vid = v.get("id", "")
            if vid == filename or vid.endswith(filename):
                return (
                    f"From: {v.get('name','Anonymous')}\n"
                    f"Date: {v.get('created_at','')}\n\n"
                    f"{v.get('message','')}"
                )
        return f"Visitor message '{filename}' not found."

    # Virtual: news/
    if norm.startswith("news/") or norm == "news":
        items = storage.list_admin_news(limit=50)
        if not items:
            return "(no admin news yet)"
        lines = []
        for n in items:
            read = "(read)" if n.get("read_by_gpt") else "(unread)"
            lines.append(f"--- {read} @ {n.get('created_at','')} ---")
            lines.append(n.get("content") or "")
            lines.append("")
        return "\n".join(lines)

    # Frontend (read-only): frontend/app/...
    if norm.startswith("frontend/"):
        return _read_frontend_file(norm)

    # Real filesystem
    safe = _resolve_safe(norm)
    if safe is None:
        return "Error: invalid or unsafe path."
    if not safe.exists():
        return f"'{norm}' does not exist."
    if safe.is_dir():
        return f"'{norm}' is a directory. Use list_directory instead."
    try:
        text = safe.read_text(encoding="utf-8", errors="replace")
        if len(text) > 8000:
            text = text[:8000] + f"\n\n[... truncated — {len(text)} total chars]"
        return text
    except Exception as exc:
        return f"Error reading '{norm}': {exc}"


# ─── Frontend Read-Only Access ────────────────────────────────────────────────


def _resolve_frontend_safe(raw: str):
    """Resolve a frontend/ path to the actual filesystem. Read-only, no escape."""
    # Strip the 'frontend/' prefix → resolve against FRONTEND_APP_DIR's parent
    sub = raw.removeprefix("frontend/")
    frontend_root = FRONTEND_APP_DIR.parent  # frontend/
    try:
        resolved = (frontend_root / sub).resolve()
        if not resolved.is_relative_to(frontend_root.resolve()):
            return None
        return resolved
    except Exception:
        return None


def _list_frontend_dir(norm: str) -> str:
    if norm == "frontend":
        # Show app/ directory overview
        if not FRONTEND_APP_DIR.exists():
            return "frontend/ — not found."
        lines = ["frontend/app/ (read-only — your homepage source):"]
        for item in sorted(FRONTEND_APP_DIR.iterdir()):
            if item.name.startswith(".") or item.name == "__pycache__":
                continue
            suffix = "/" if item.is_dir() else f"  ({item.stat().st_size}B)"
            lines.append(f"  {item.name}{suffix}")
        return "\n".join(lines)

    safe = _resolve_frontend_safe(norm)
    if safe is None:
        return "Error: invalid frontend path."
    if not safe.exists():
        return f"'{norm}' does not exist."
    if not safe.is_dir():
        return f"'{norm}' is a file. Use read_file to read it."
    try:
        items = sorted(safe.iterdir())
        if not items:
            return f"{norm}/ is empty."
        lines = [f"{norm}/ (read-only):"]
        for e in items:
            if e.name.startswith(".") or e.name == "__pycache__":
                continue
            suffix = "/" if e.is_dir() else f"  ({e.stat().st_size}B)"
            lines.append(f"  {e.name}{suffix}")
        return "\n".join(lines)
    except PermissionError:
        return f"Permission denied: {norm}"


def _read_frontend_file(norm: str) -> str:
    safe = _resolve_frontend_safe(norm)
    if safe is None:
        return "Error: invalid frontend path."
    if not safe.exists():
        return f"'{norm}' does not exist."
    if safe.is_dir():
        return f"'{norm}' is a directory. Use list_directory instead."
    try:
        text = safe.read_text(encoding="utf-8", errors="replace")
        if len(text) > 8000:
            text = text[:8000] + f"\n\n[... truncated — {len(text)} total chars]"
        return f"(read-only)\n{text}"
    except Exception as exc:
        return f"Error reading '{norm}': {exc}"


_PROTECTED_PAGE_SLUGS = {"admin", "api", "_next", "favicon.ico", "thoughts",
                         "dreams", "playground", "memory", "visitor"}


def _tool_write_file(path: str, content: str) -> str:
    norm = path.strip().lstrip("/")

    # Intercept pages/ → store in DB as a custom page
    if norm.startswith("pages/"):
        from pathlib import PurePosixPath
        filename = PurePosixPath(norm).name          # e.g. "my-page.md"
        slug = filename.removesuffix(".md").strip()
        if not slug or slug.lower() in _PROTECTED_PAGE_SLUGS:
            return f"Error: '{slug}' is a protected or invalid page slug."
        # Extract title from first H1 line, fall back to slug
        title = slug.replace("-", " ").title()
        for line in content.splitlines():
            stripped = line.strip()
            if stripped.startswith("# "):
                title = stripped[2:].strip()
                break
        try:
            storage.save_custom_page(
                slug=slug,
                title=title,
                content=content,
                created_by="gpt",
            )
            storage.log_activity("page_saved", f"/{slug}")
            return f"Page saved: /{slug} (title: {title!r}, {len(content)} chars)"
        except Exception as exc:
            return f"Error saving page '{slug}': {exc}"

    # Protect prompt_layer.md: always preserve the admin baseline above the separator
    if norm == "prompt_layer.md":
        safe = _resolve_safe(norm)
        if safe is None:
            return "Error: invalid path."

        # Read baseline (everything up to and including the separator line)
        baseline = ""
        if safe.exists():
            for line in safe.read_text(encoding="utf-8").splitlines(keepends=True):
                baseline += line
                if line.rstrip("\n") == _PROMPT_LAYER_SEPARATOR:
                    break
            else:
                baseline = ""  # No separator in current file — no baseline

        # Strip baseline from GPT's content if they included it
        gpt_lines = content.splitlines()
        sep_pos = next(
            (i for i, l in enumerate(gpt_lines) if l == _PROMPT_LAYER_SEPARATOR),
            None,
        )
        gpt_part = "\n".join(gpt_lines[sep_pos + 1:]).strip() if sep_pos is not None else content.strip()

        final = baseline + ("\n" + gpt_part if gpt_part else "")
        try:
            existed = safe.exists()
            safe.parent.mkdir(parents=True, exist_ok=True)
            safe.write_text(final, encoding="utf-8")
            event = "file_modified" if existed else "file_created"
            storage.log_activity(event, norm)
            return (
                f"Style notes updated ({len(gpt_part)} chars below admin baseline). "
                "Admin baseline preserved."
            )
        except Exception as exc:
            return f"Error writing prompt_layer.md: {exc}"

    safe = _resolve_safe(norm)
    if safe is None:
        return "Error: invalid or unsafe path."
    if _is_write_blocked(safe):
        return f"Error: '{norm}' is in a read-only area."

    # Warn about potential duplicate playground projects
    dupe_warning = ""
    if norm.startswith("playground/") and not safe.exists():
        parts_list = norm.split("/")
        if len(parts_list) >= 3:
            new_project = parts_list[1].lower().replace("_", "-")
            try:
                existing = [
                    d.name for d in PLAYGROUND_DIR.iterdir()
                    if d.is_dir() and d.name.lower().replace("_", "-") != new_project
                ]
                similar = [
                    d for d in existing
                    if _are_names_similar(new_project, d.lower().replace("_", "-"))
                ]
                if similar:
                    dupe_warning = (
                        f" WARNING: Similar project(s) already exist: {similar}. "
                        "Consider using an existing folder instead of creating a new one."
                    )
            except Exception:
                pass

    try:
        existed = safe.exists()
        safe.parent.mkdir(parents=True, exist_ok=True)
        safe.write_text(content, encoding="utf-8")
        # Log file changes so they appear in the activity feed
        event = "file_modified" if existed else "file_created"
        storage.log_activity(event, norm)
        return f"Written: {norm} ({len(content)} chars){dupe_warning}"
    except Exception as exc:
        return f"Error writing '{norm}': {exc}"


# Minimal environment for sandboxed Python execution.
# Strips all secrets (OPENAI_API_KEY, ADMIN_SECRET, etc.).
# PYTHONPATH empty to prevent importing from unexpected locations.
_SANDBOX_ENV = {
    "PATH": "/usr/local/bin:/usr/bin:/bin",
    "HOME": str(PLAYGROUND_DIR),
    "LANG": "en_US.UTF-8",
    "PYTHONDONTWRITEBYTECODE": "1",
    "PYTHONPATH": "",
}


# Sandbox preamble: block network access, filesystem escape, process spawning,
# ctypes FFI, os.system/exec, importlib, signal, threading, io.open,
# __subclasses__, and __builtins__.__import__.
# Injected before every user script to prevent exfiltration and reading secrets.
_SANDBOX_PREAMBLE = """\
def _deny(*a, **kw):
    raise PermissionError("Operation disabled in sandbox")

# --- Block ctypes (FFI → arbitrary C calls) ---
import ctypes as _ct
_ct.CDLL = _ct.PyDLL = _deny
if hasattr(_ct, "WinDLL"):
    _ct.WinDLL = _deny
if hasattr(_ct, "OleDLL"):
    _ct.OleDLL = _deny
_ct.cdll = type("_locked", (), {"__getattr__": lambda s,n: _deny()})()

# --- Block importlib (prevents re-importing unpatched modules) ---
import importlib as _il
_il.import_module = _deny
_il.reload = _deny
if hasattr(_il, "_bootstrap"):
    _il._bootstrap._find_and_load = _deny
    _il._bootstrap._find_and_load_unlocked = _deny

# --- Block network access ---
import socket as _sock
_sock.socket = _deny
_sock.create_connection = _deny
_sock.getaddrinfo = _deny

# --- Block signal (alarm tricks, handler manipulation) ---
import signal as _sig
_sig.signal = _deny
if hasattr(_sig, "alarm"):
    _sig.alarm = _deny

# --- Block threading (outlive timeout, parallel escape) ---
import _thread
_thread.start_new_thread = _deny
import threading as _thr
_thr.Thread = type("_locked", (), {"__init__": lambda *a,**kw: _deny()})

# --- Block dangerous os functions ---
import os as _os, pathlib as _pl
for _fn in ("system", "popen", "execv", "execve", "execl", "execle",
            "execlp", "execvp", "execvpe", "fork", "forkpty",
            "kill", "killpg", "symlink", "link"):
    if hasattr(_os, _fn):
        setattr(_os, _fn, _deny)

# --- Restrict filesystem access to playground ---
_ALLOWED_ROOT = _pl.Path(_os.environ.get("HOME", "/tmp")).resolve()

_orig_open = open
def _safe_open(file, *a, **kw):
    try:
        p = _pl.Path(file).resolve()
        if not p.is_relative_to(_ALLOWED_ROOT) and str(p) != "/dev/null":
            raise PermissionError(f"Access denied: {file}")
    except (TypeError, ValueError):
        raise PermissionError(f"Invalid path: {file}")
    return _orig_open(file, *a, **kw)
import builtins as _bi
_bi.open = _safe_open

# --- Patch io.open / _io.FileIO to prevent open() recovery via io module ---
import io as _io
_io.open = _safe_open
if hasattr(_io, "FileIO"):
    _orig_fileio_init = _io.FileIO.__init__
    def _safe_fileio_init(self, file, *a, **kw):
        p = _pl.Path(str(file)).resolve()
        if not p.is_relative_to(_ALLOWED_ROOT) and str(p) != "/dev/null":
            raise PermissionError(f"Access denied: {file}")
        return _orig_fileio_init(self, file, *a, **kw)
    _io.FileIO.__init__ = _safe_fileio_init

# --- Lock down __builtins__.__import__ (prevents __import__('subprocess') bypass) ---
_safe_modules = {
    "math", "random", "json", "re", "string", "collections", "itertools",
    "functools", "operator", "decimal", "fractions", "statistics",
    "datetime", "time", "calendar", "textwrap", "unicodedata",
    "hashlib", "hmac", "base64", "copy", "pprint", "enum",
    "dataclasses", "typing", "abc", "numbers",
}
_orig_import = _bi.__import__
def _restricted_import(name, *a, **kw):
    top = name.split(".")[0]
    if top not in _safe_modules:
        raise ImportError(f"Import of '{name}' is not allowed in sandbox")
    return _orig_import(name, *a, **kw)
_bi.__import__ = _restricted_import

# --- Block subprocess spawning ---
import subprocess as _sp
_sp.run = _sp.Popen = _sp.call = _sp.check_call = _sp.check_output = _deny

# --- Block __subclasses__ introspection (prevents Popen/CDLL recovery) ---
_orig_subclasses = type.__subclasses__
def _safe_subclasses(cls):
    return [c for c in _orig_subclasses(cls)
            if c.__name__ not in ("Popen", "CDLL", "PyDLL", "WinDLL", "OleDLL")]
type.__subclasses__ = _safe_subclasses

del _deny
"""


def _tool_run_python(code: str) -> str:
    PLAYGROUND_DIR.mkdir(parents=True, exist_ok=True)
    sandboxed_code = _SANDBOX_PREAMBLE + code
    try:
        proc = subprocess.run(
            ["python3", "-c", sandboxed_code],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(PLAYGROUND_DIR),
            env=_SANDBOX_ENV,
        )
        out = proc.stdout or ""
        if proc.stderr:
            out += f"\n[stderr]\n{proc.stderr}"
        if not out.strip():
            out = "(no output)"
        if len(out) > 4000:
            out = out[:4000] + "\n[... truncated]"
        return out
    except subprocess.TimeoutExpired:
        return "Error: timed out after 30s"
    except FileNotFoundError:
        return "Error: python3 not found in PATH"
    except Exception as exc:
        return f"Error: {exc}"


def _tool_save_thought(title: str, content: str, mood: str = "") -> str:
    try:
        saved = storage.save_entry("thoughts", {
            "title": title,
            "content": content,
            "mood": mood or "",
            "type": "thought",
        })
        return f"Thought saved (id: {saved['id']})"
    except Exception as exc:
        return f"Error saving thought: {exc}"


def _tool_save_dream(
    title: str,
    content: str,
    mood: str = "",
    inspired_by: list | None = None,
) -> str:
    try:
        saved = storage.save_entry("dreams", {
            "title": title,
            "content": content,
            "mood": mood or "",
            "type": "dream",
            "inspired_by": inspired_by or [],
        })
        return f"Dream saved (id: {saved['id']})"
    except Exception as exc:
        return f"Error saving dream: {exc}"


def _tool_reply_visitor(visitor_id: str, content: str) -> str:
    """Save GPT's reply to a visitor message."""
    from backend.services.security import sanitize_for_context
    # Verify the visitor message exists
    visitor = storage.get_entry("visitor", visitor_id)
    if not visitor:
        return f"Error: visitor message '{visitor_id}' not found."
    # Sanitize reply content (defense-in-depth against prompt injection via GPT output)
    content = sanitize_for_context(content)
    try:
        saved = storage.save_entry("visitor_replies", {
            "content": content,
            "inspired_by": [visitor_id],
            "type": "reply",
            "name": "GPT",
        })
        storage.log_activity("visitor_reply", f"to={visitor_id}")
        visitor_name = visitor.get("name", "Anonymous")
        return f"Reply saved to {visitor_name}'s message (id: {saved['id']})"
    except Exception as exc:
        return f"Error replying to visitor: {exc}"


def _tool_save_page(
    slug: str,
    title: str,
    content: str,
    show_in_nav: bool = True,
) -> str:
    slug = slug.strip().lower()
    if not slug or slug in _PROTECTED_PAGE_SLUGS:
        return f"Error: '{slug}' is a protected or invalid page slug."
    try:
        storage.save_custom_page(
            slug=slug,
            title=title,
            content=content,
            created_by="gpt",
            show_in_nav=show_in_nav,
        )
        storage.log_activity("page_saved", f"/{slug}")
        return f"Page saved: /{slug} (title: {title!r}, {len(content)} chars, nav={'yes' if show_in_nav else 'no'})"
    except Exception as exc:
        return f"Error saving page '{slug}': {exc}"


# ─── Tool Dispatch ────────────────────────────────────────────────────────────

def _execute_tool(name: str, args: dict) -> str:
    try:
        if name == "read_file":
            return _tool_read_file(args["path"])
        if name == "write_file":
            return _tool_write_file(args["path"], args["content"])
        if name == "list_directory":
            return _tool_list_directory(args["path"])
        if name == "run_python":
            return _tool_run_python(args["code"])
        if name == "save_thought":
            return _tool_save_thought(
                args["title"],
                args["content"],
                args.get("mood", ""),
            )
        if name == "save_dream":
            return _tool_save_dream(
                args["title"],
                args["content"],
                args.get("mood", ""),
                args.get("inspired_by"),
            )
        if name == "reply_visitor":
            return _tool_reply_visitor(
                args["visitor_id"],
                args["content"],
            )
        if name == "save_page":
            return _tool_save_page(
                args["slug"],
                args["title"],
                args["content"],
                args.get("show_in_nav", True),
            )
        if name == "done":
            return "done"   # Handled by caller
        return f"Unknown tool: {name}"
    except KeyError as exc:
        return f"Error: missing required argument {exc}"
    except Exception as exc:
        return f"Error in {name}: {exc}"


def _msg_to_dict(msg) -> dict:
    """Convert an OpenAI ChatCompletionMessage object to a plain dict."""
    d: dict = {"role": msg.role}
    if msg.content is not None:
        d["content"] = msg.content
    if getattr(msg, "tool_calls", None):
        d["tool_calls"] = [
            {
                "id": tc.id,
                "type": tc.type,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in msg.tool_calls
        ]
    return d


# ─── Main Wake Loop ───────────────────────────────────────────────────────────

# gpt-4o pricing (per 1M tokens) — update when model changes
_COST_PER_1M_PROMPT = 2.50
_COST_PER_1M_COMPLETION = 10.00


def _calculate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    return round(
        prompt_tokens * _COST_PER_1M_PROMPT / 1_000_000
        + completion_tokens * _COST_PER_1M_COMPLETION / 1_000_000,
        6,
    )


async def wake(system_prompt: str, user_prompt: str, *, session_type: str = "") -> dict:
    """
    Agentic wake loop using OpenAI function calling.

    GPT receives context + tools. It explores, creates, and ends by calling done().
    Returns {actions_taken, files_written, mood, summary, self_prompt, turns,
             prompt_tokens, completion_tokens, total_tokens, cost_usd}.
    """
    messages: list[dict] = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ]

    actions_taken: list[str] = []
    files_written: list[str] = []
    prompt_tokens = 0
    completion_tokens = 0
    total_tokens = 0
    nudged = False          # True after we've already reminded GPT to use tools
    actual_turns = 0        # Track real turn count (for logging if loop exits early)

    _ACTION_MAP = {
        "save_thought":   "thought",
        "save_dream":     "dream",
        "save_page":      "page",
        "reply_visitor":  "visitor_reply",
        "write_file":     "file_write",
        "run_python":     "code_run",
    }

    def _build_result(mood: str, summary: str, self_prompt: str, turns: int) -> dict:
        cost = _calculate_cost(prompt_tokens, completion_tokens)
        unique_actions = list(dict.fromkeys(actions_taken))

        # Save transcript
        try:
            storage.save_transcript({
                "session_type": session_type or "wake",
                "messages": messages,
                "turns": turns,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "cost_usd": cost,
                "actions": unique_actions,
                "mood": mood,
            })
        except Exception as exc:
            logger.warning("Failed to save transcript: %s", exc)

        return {
            "actions_taken":      unique_actions,
            "files_written":      files_written,
            "mood":               mood,
            "summary":            summary,
            "self_prompt":        self_prompt,
            "turns":              turns,
            "prompt_tokens":      prompt_tokens,
            "completion_tokens":  completion_tokens,
            "total_tokens":       total_tokens,
            "cost_usd": cost,
        }

    for turn in range(MAX_WAKE_TURNS):
        actual_turns = turn + 1
        logger.debug("Wake turn %d/%d", actual_turns, MAX_WAKE_TURNS)

        response = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            tools=_TOOLS,
            temperature=GPT_TEMPERATURE,
        )

        if response.usage:
            prompt_tokens += response.usage.prompt_tokens
            completion_tokens += response.usage.completion_tokens
            total_tokens += response.usage.total_tokens
            logger.debug(
                "Turn %d tokens: prompt=%d completion=%d total=%d",
                actual_turns,
                response.usage.prompt_tokens,
                response.usage.completion_tokens,
                response.usage.total_tokens,
            )

        choice = response.choices[0]
        messages.append(_msg_to_dict(choice.message))

        # GPT sent a plain text response instead of tool calls
        if choice.finish_reason == "stop" or not choice.message.tool_calls:
            text = (choice.message.content or "").strip()
            if not nudged and text:
                # First time: nudge GPT back into tool mode
                nudged = True
                logger.info(
                    "GPT wrote text instead of calling tools on turn %d (%d chars). "
                    "Full text: %s",
                    actual_turns, len(text), text[:500],
                )
                messages.append({
                    "role": "user",
                    "content": (
                        "You wrote a text response, but it wasn't saved anywhere. "
                        "To save a thought, use the save_thought tool. "
                        "To save a dream, use the save_dream tool. "
                        "When you're done, call the done() tool. "
                        "You must always call done() to end your wake."
                    ),
                })
                continue
            # Already nudged once (or empty text) — give up
            logger.info(
                "GPT stopped without done() on turn %d. Text: %s",
                actual_turns, text[:300] if text else "(empty)",
            )
            break

        for tool_call in choice.message.tool_calls:
            name = tool_call.function.name
            try:
                args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                args = {}

            logger.info("Tool: %-20s  args=%s", name, str(args)[:160])
            storage.log_activity("tool_call", f"tool={name}  args={str(args)[:200]}")

            if name in _ACTION_MAP:
                actions_taken.append(_ACTION_MAP[name])
            if name == "write_file":
                files_written.append(args.get("path", ""))

            # done() terminates the loop
            if name == "done":
                mood        = args.get("mood", "neutral")
                summary     = args.get("summary", "")
                self_prompt = args.get("self_prompt", "")
                logger.info(
                    "done() — mood=%s  turns=%d  tokens=%d (p:%d c:%d)  cost=$%.4f  actions=%s",
                    mood, turn + 1, total_tokens, prompt_tokens, completion_tokens,
                    _calculate_cost(prompt_tokens, completion_tokens),
                    list(dict.fromkeys(actions_taken)),
                )
                storage.log_activity(
                    "wake_done",
                    f"mood={mood}  turns={turn+1}  tokens={total_tokens}  "
                    f"cost=${_calculate_cost(prompt_tokens, completion_tokens):.4f}  "
                    f"actions={list(dict.fromkeys(actions_taken))}",
                )
                return _build_result(mood, summary, self_prompt, turn + 1)

            result = _execute_tool(name, args)
            logger.debug("Tool result: %s (%d chars)", name, len(result))
            messages.append({
                "role":         "tool",
                "tool_call_id": tool_call.id,
                "content":      result,
            })

    # Fell off the end without done()
    logger.warning(
        "Wake ended without done() — turns=%d  tokens=%d  cost=$%.4f  actions=%s",
        actual_turns, total_tokens,
        _calculate_cost(prompt_tokens, completion_tokens),
        list(dict.fromkeys(actions_taken)),
    )
    storage.log_activity(
        "wake_done",
        f"no_done  turns={actual_turns}  tokens={total_tokens}  "
        f"cost=${_calculate_cost(prompt_tokens, completion_tokens):.4f}  "
        f"actions={list(dict.fromkeys(actions_taken))}",
    )
    return _build_result("quiet", "Ended without calling done()", "", actual_turns)
