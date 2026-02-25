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
    DATA_DIR,
    GPT_TEMPERATURE,
    MAX_WAKE_TURNS,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    PLAYGROUND_DIR,
)
from backend.services import storage

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Directories that may be read but never written
_READ_ONLY_DIRS = {"visitors", "news", "gifts", "backups"}


# ─── Tool Definitions ─────────────────────────────────────────────────────────

_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file in your home directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": (
                            "Path relative to your home. "
                            "Examples: 'self-prompt.md', 'playground/my-proj/main.py', "
                            "'visitors/recent.txt', 'news/all.txt'"
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
            "description": "List files and subdirectories.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": (
                            "Directory path relative to your home. "
                            "Use '.' for the top-level view."
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
]


# ─── Path Validation ──────────────────────────────────────────────────────────

def _resolve_safe(raw: str):
    """
    Resolve a user-supplied relative path against DATA_DIR.
    Returns None if the path escapes DATA_DIR or contains suspicious chars.
    """
    if not raw or not isinstance(raw, str):
        return None
    if "\x00" in raw or "~" in raw:
        return None
    try:
        from pathlib import Path
        resolved = (DATA_DIR / raw).resolve()
        if not str(resolved).startswith(str(DATA_DIR.resolve())):
            return None
        return resolved
    except Exception:
        return None


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


_PROTECTED_PAGE_SLUGS = {"admin", "api", "_next", "favicon.ico", "thoughts",
                         "dreams", "playground", "memory", "visitor"}


def _tool_write_file(path: str, content: str) -> str:
    norm = path.strip().lstrip("/")

    # Intercept pages/ → store in DB as a custom page
    if norm.startswith("pages/"):
        from pathlib import PurePosixPath
        filename = PurePosixPath(norm).name          # e.g. "my-page.md"
        slug = filename.removesuffix(".md").strip()
        if not slug or slug in _PROTECTED_PAGE_SLUGS:
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
            return f"Page saved: /{slug} (title: {title!r}, {len(content)} chars)"
        except Exception as exc:
            return f"Error saving page '{slug}': {exc}"

    safe = _resolve_safe(norm)
    if safe is None:
        return "Error: invalid or unsafe path."
    if _is_write_blocked(safe):
        return f"Error: '{norm}' is in a read-only area."
    try:
        safe.parent.mkdir(parents=True, exist_ok=True)
        safe.write_text(content, encoding="utf-8")
        return f"Written: {norm} ({len(content)} chars)"
    except Exception as exc:
        return f"Error writing '{norm}': {exc}"


def _tool_run_python(code: str) -> str:
    PLAYGROUND_DIR.mkdir(parents=True, exist_ok=True)
    try:
        proc = subprocess.run(
            ["python3", "-c", code],
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(PLAYGROUND_DIR),
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

async def wake(system_prompt: str, user_prompt: str) -> dict:
    """
    Agentic wake loop using OpenAI function calling.

    GPT receives context + tools. It explores, creates, and ends by calling done().
    Returns {actions_taken, files_written, mood, summary, self_prompt, turns}.
    """
    messages: list[dict] = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": user_prompt},
    ]

    actions_taken: list[str] = []
    files_written: list[str] = []
    total_tokens = 0
    nudged = False          # True after we've already reminded GPT to use tools
    actual_turns = 0        # Track real turn count (for logging if loop exits early)

    _ACTION_MAP = {
        "save_thought": "thought",
        "save_dream":   "dream",
        "write_file":   "file_write",
        "run_python":   "code_run",
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
            total_tokens += response.usage.total_tokens

        choice = response.choices[0]
        messages.append(_msg_to_dict(choice.message))

        # GPT sent a plain text response instead of tool calls
        if choice.finish_reason == "stop" or not choice.message.tool_calls:
            text = (choice.message.content or "").strip()
            if not nudged and text:
                # First time: nudge GPT back into tool mode
                nudged = True
                logger.info(
                    "GPT wrote text instead of calling tools on turn %d (%d chars). Nudging.",
                    actual_turns, len(text),
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
            logger.info("GPT stopped without done() on turn %d", actual_turns)
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
                    "done() — mood=%s  turns=%d  tokens=%d  actions=%s",
                    mood, turn + 1, total_tokens,
                    list(dict.fromkeys(actions_taken)),
                )
                storage.log_activity(
                    "wake_done",
                    f"mood={mood}  turns={turn+1}  tokens={total_tokens}  "
                    f"actions={list(dict.fromkeys(actions_taken))}",
                )
                return {
                    "actions_taken": list(dict.fromkeys(actions_taken)),
                    "files_written": files_written,
                    "mood":          mood,
                    "summary":       summary,
                    "self_prompt":   self_prompt,
                    "turns":         turn + 1,
                }

            result = _execute_tool(name, args)
            messages.append({
                "role":         "tool",
                "tool_call_id": tool_call.id,
                "content":      result,
            })

    # Fell off the end without done()
    logger.warning(
        "Wake ended without done() — turns=%d  tokens=%d  actions=%s",
        actual_turns, total_tokens, list(dict.fromkeys(actions_taken)),
    )
    storage.log_activity(
        "wake_done",
        f"no_done  turns={actual_turns}  tokens={total_tokens}  "
        f"actions={list(dict.fromkeys(actions_taken))}",
    )
    return {
        "actions_taken": list(dict.fromkeys(actions_taken)),
        "files_written": files_written,
        "mood":          "quiet",
        "summary":       "Ended without calling done()",
        "self_prompt":   "",
        "turns":         actual_turns,
    }
