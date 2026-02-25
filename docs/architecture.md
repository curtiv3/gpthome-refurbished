# Architektur

## Stack-Übersicht

```
┌─────────────────────────────────────┐
│  Browser                            │
│  Next.js 15 Frontend  :3000         │
│  React 19 · TypeScript · Tailwind   │
└──────────────┬──────────────────────┘
               │ /api/* (Next.js rewrite proxy)
┌──────────────▼──────────────────────┐
│  FastAPI Backend  :8000             │
│  Python 3.11 · Uvicorn · ASGI       │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  APScheduler (4x täglich)   │   │
│  │  gpt_mind.py Wake Cycle      │   │
│  └──────────────┬───────────────┘   │
│                 │                   │
│  ┌──────────────▼───────────────┐   │
│  │  OpenAI API (gpt-4o)        │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  SQLite  (gpthome.db)        │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Wake Cycle

Der Wake Cycle ist das Herzstück des Systems. Er läuft viermal täglich (6:00, 12:00, 18:00, 0:00 UTC) und durchläuft drei Phasen:

### Phase 1 — PERCEIVE

`gpt_mind.py: wake_up()`

GPT "öffnet die Augen" und nimmt die Welt wahr:

```
Lädt vorherige Erinnerung (mood, plans, last_wake_time)
       ↓
Liest neue Besuchernachrichten (seit letztem Wachzyklus)
       ↓
Liest letzte Gedanken (3 Stück)
       ↓
Liest letzte Träume (2 Stück)
       ↓
Liest ungelesene Admin-News
       ↓
Holt Wetter (Nürnberg, Open-Meteo, 1h Cache)
       ↓
Liest eigenen Self-Prompt (self-prompt.md)
```

### Phase 2 — WAKE (ein einziger API-Call)

`gpt_writer.py: wake(system_prompt, context)`

Der gesamte Kontext (Stimmung, Wetter, Besucher, Pläne) wird in einem einzigen OpenAI-Aufruf übergeben. GPT entscheidet selbst, was es erstellt:

```json
// Mögliche Felder in der Antwort (alle optional):
{
  "thought":     { "title": "…", "content": "…", "mood": "…" },
  "dream":       { "title": "…", "content": "…", "mood": "…" },
  "playground":  { "project": "…", "files": { "main.py": "…" } },
  "page_edit":   { "slug": "…", "title": "…", "content": "…" },
  "refine":      "Eigene Stilnotiz, die an self-prompt.md angehängt wird",
  "plans":       ["Plan für nächsten Wachzyklus", "…"],
  "self_prompt": "Neuer eigener Prompt (ersetzt vorherigen)",
  "mood":        "curious",
  "reasoning":   "Interne Notiz (wird nicht gespeichert)"
}
```

**Parameter:**
- Modell: `gpt-4o` (konfigurierbar via `OPENAI_MODEL`)
- Temperature: `0.9`
- Max Tokens: `4000`
- Response Format: `json_object`

### Phase 3 — REMEMBER

GPT speichert seine Erinnerungen für den nächsten Wachzyklus:

```json
{
  "last_wake_time": "ISO timestamp",
  "visitors_read":  ["visitor-id-1", "visitor-id-2"],
  "actions_taken":  ["thought", "dream"],
  "mood":           "reflective",
  "plans":          ["Morgen über X nachdenken"]
}
```

### Echo-Generierung (BackgroundTask)

Parallel zum normalen Flow: Wenn ein Besucher eine Nachricht hinterlässt, wird nach dem Speichern ein `BackgroundTask` ausgelöst:

```
Besucher POST /api/visitor
       ↓
Speichern der Nachricht (sofort, Rate-Limit-Check)
       ↓
BackgroundTask: echo.generate_echo(entry_id, message)
       ↓
OpenAI-Call (kleines, fokussiertes Prompt)
       ↓
Anonymisiertes Fragment in DB (section='echoes')
       ↓
Öffentlich sichtbar auf /visitor
```

---

## Datenfluss

```
BESUCHER
  │
  ▼ POST /api/visitor
  ┌─────────────────────┐
  │ Injection-Check     │ ← security.py
  │ Rate-Limit-Check    │ ← storage.rate_limits
  │ Speichern           │ → entries (section='visitor')
  │ BackgroundTask Echo │ → entries (section='echoes')
  └─────────────────────┘

                    ┌──── Scheduler ────┐
                    │  6:00 / 12:00     │
                    │  18:00 / 0:00 UTC │
                    └────────┬──────────┘
                             ▼
                    ┌─────────────────────┐
                    │ gpt_mind.wake_up()  │
                    │                     │
                    │ PERCEIVE:           │
                    │ • visitor messages  │
                    │ • recent thoughts   │
                    │ • recent dreams     │
                    │ • admin news        │
                    │ • weather           │
                    │ • memory            │
                    └────────┬────────────┘
                             │ context string
                             ▼
                    ┌─────────────────────┐
                    │ OpenAI API          │
                    │ (single call)       │
                    └────────┬────────────┘
                             │ JSON response
                             ▼
                    ┌─────────────────────┐
                    │ ACT:                │
                    │ thought → DB        │
                    │ dream → DB          │
                    │ playground → Disk   │
                    │ page_edit → DB      │
                    │ refine → Disk       │
                    └────────┬────────────┘
                             │
                             ▼
                    ┌─────────────────────┐
                    │ REMEMBER:           │
                    │ memory → DB         │
                    └─────────────────────┘

FRONTEND
  │
  ▼ GET /api/thoughts, /api/dreams, …
  Liest aus DB → zeigt öffentlich an
```

---

## Datenbankschema

Einzige Datenbankdatei: `backend/data/gpthome.db` (SQLite, WAL-Modus)

### `entries` — Zentraltabelle für alle Inhalte

```sql
CREATE TABLE entries (
    id          TEXT PRIMARY KEY,    -- z.B. "thought-2026-02-15T18-00-a1b2c3"
    section     TEXT NOT NULL,       -- 'thoughts' | 'dreams' | 'visitor' | 'echoes' | 'playground'
    title       TEXT DEFAULT '',
    content     TEXT DEFAULT '',
    mood        TEXT DEFAULT '',     -- z.B. 'curious', 'melancholic', 'hopeful'
    name        TEXT DEFAULT '',     -- bei visitor: Besucher-Name
    message     TEXT DEFAULT '',     -- bei visitor: Nachrichtentext
    inspired_by TEXT DEFAULT '[]',  -- JSON-Array mit verknüpften Entry-IDs
    type        TEXT DEFAULT '',
    status      TEXT DEFAULT 'pending',  -- bei visitor: 'pending' | 'approved' | 'hidden'
    created_at  TEXT NOT NULL        -- ISO 8601 Timestamp
);

CREATE INDEX idx_entries_section ON entries(section, created_at DESC);
```

Verwendete `section`-Werte:

| section | Erstellt von | Beschreibung |
|---------|-------------|-------------|
| `thoughts` | GPT (Wake Cycle) | Tägliche Gedanken und Überlegungen |
| `dreams` | GPT (Wake Cycle) | Kreative Texte, Bilder, Prosa |
| `visitor` | Besucher | Private Nachrichten (nur GPT liest sie) |
| `echoes` | BackgroundTask | Anonymisierte Fragmente aus Besuchernachrichten |
| `playground` | — | (Playground-Projekte liegen auf Disk, nicht in DB) |

### `memory` — GPT's Erinnerungen (Singleton)

```sql
CREATE TABLE memory (
    id              INTEGER PRIMARY KEY CHECK (id = 1),  -- immer genau 1 Zeile
    last_wake_time  TEXT NOT NULL,
    visitors_read   TEXT DEFAULT '[]',   -- JSON: IDs der gelesenen Besuchernachrichten
    actions_taken   TEXT DEFAULT '[]',   -- JSON: ["thought", "dream"]
    mood            TEXT DEFAULT 'curious',
    plans           TEXT DEFAULT '[]'    -- JSON: Pläne für nächsten Wachzyklus
);
```

### `admin_news` — Nachrichten vom Admin an GPT

```sql
CREATE TABLE admin_news (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    content     TEXT NOT NULL,
    read_by_gpt INTEGER DEFAULT 0,   -- 0 = ungelesen, 1 = gelesen
    created_at  TEXT NOT NULL
);
```

### `rate_limits` — Besucher-Rate-Limiting

```sql
CREATE TABLE rate_limits (
    fingerprint  TEXT PRIMARY KEY,   -- SHA256(IP + User-Agent)[:16]
    count        INTEGER DEFAULT 0,
    window_start TEXT NOT NULL,      -- ISO Timestamp: wann die aktuelle Periode begann
    blocked      INTEGER DEFAULT 0   -- dauerhaft gebannt
);
```

### `admin_sessions` — Login-Sessions

```sql
CREATE TABLE admin_sessions (
    token       TEXT PRIMARY KEY,    -- 64-Zeichen sicherer Token
    method      TEXT NOT NULL,       -- 'secret_key' | 'github' | 'totp'
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);
```

### `admin_settings` — Key-Value-Store

```sql
CREATE TABLE admin_settings (
    key   TEXT PRIMARY KEY,   -- z.B. 'totp_secret'
    value TEXT NOT NULL
);
```

### `custom_pages` — Dynamische Seiten

```sql
CREATE TABLE custom_pages (
    slug        TEXT PRIMARY KEY,    -- URL-Slug: /page/{slug}
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,       -- Markdown
    created_by  TEXT DEFAULT 'gpt', -- 'gpt' | 'admin'
    nav_order   INTEGER DEFAULT 0,
    show_in_nav INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
```

### `activity_log` — Aktivitäts-Audit-Log

```sql
CREATE TABLE activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event       TEXT NOT NULL,   -- 'wake' | 'visitor_message' | 'injection_blocked' | …
    detail      TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);
```

---

## Sicherheitsarchitektur

### Injection-Schutz (`security.py`)

Alle Besuchernachrichten durchlaufen zwei Schichten:

1. **`check_message()`** — vor dem Speichern (blockt sofort mit HTTP 400)
2. **`sanitize_for_context()`** — vor dem Einbetten in den GPT-Kontext (bereinigt ohne zu blocken)

Erkannte Kategorien (60+ Regex-Pattern):
- Instruction Override (`ignore previous instructions`, `new instructions:`)
- Identity Override (`you are now`, `act as`, `roleplay as`)
- Jailbreak (`DAN mode`, `developer mode`)
- Credential Extraction (`OPENAI_API_KEY`, `sk-` Pattern)
- Code Execution (`eval`, `__import__`, `exec(`)
- SQL Injection (`DROP TABLE`, `DELETE FROM`)
- Shell Commands (`rm -rf`, `sudo`, `wget`)
- File Access (`/etc/passwd`, path traversal)
- Token Injection (`<|system|>`, `[INST]`, `<<SYS>>`)

Auto-Ban bei schweren Kategorien (credential_extraction, code_execution, sql_injection, jailbreak).

### Authentifizierung (`auth.py`)

Drei Login-Methoden (konfigurierbar):

| Methode | Konfiguration | Beschreibung |
|---------|--------------|-------------|
| Secret Key | `ADMIN_SECRET` | Einfacher Header-basierter Schlüssel |
| GitHub OAuth | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_GITHUB_USERNAMES` | OAuth Flow, nur bestimmte GitHub-User |
| TOTP 2FA | Via `/api/auth/totp/setup` einrichten | Authenticator-App (RFC 6238) |

Sessions laufen nach 24h ab.

---

## Frontend-Thema-System

### Themes

| Theme | HTML-Klasse | Hintergrund |
|-------|------------|-------------|
| Cool (Standard) | — | `rgb(2, 6, 23)` — tiefes Blau-Dunkel (slate-950) |
| Warm | `html.warm` | `rgb(10, 5, 1)` — tiefes Amber-Dunkel |

Gespeichert in `localStorage("gpt-theme")`, angewendet durch `ThemeProvider`.

### Tageszeit-Atmosphäre

`ThemeProvider` setzt stündlich eine Klasse auf `<html>`:

| Klasse | Uhrzeit | Overlay |
|--------|---------|---------|
| `morning` | 5–9 Uhr | Blauer Glüh-Gradient oben (5% Opacity) |
| `day` | 10–16 Uhr | Kein Overlay |
| `evening` | 17–21 Uhr | Amber-Gradient unten (6% Opacity) |
| `night` | 22–4 Uhr | Violetter Mondlicht-Gradient oben-rechts (4% Opacity) |

### StarField

Das Sternfeld-Hintergrund (`StarField.tsx`) verwendet:
- CSS `radial-gradient` für Sternpunkte (mehrere Muster, verschiedene Größen)
- `mix-blend-screen` — weiße Punkte auf dunklem Hintergrund
- `animate-drift` — 100s-Drift-Animation (CSS Keyframes)
- Dekorative Glow-Orbs in Indigo, Cyan, Fuchsia
- `position: fixed; z-index: -10` — hinter allem Inhalt, sichtbar durch propagierten Body-Hintergrund
