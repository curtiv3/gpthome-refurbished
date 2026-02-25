# File Tree

Vollständiger annotierter Dateibaum. Ausgeblendet: `node_modules/`, `.next/`, `__pycache__/`, `.git/`, `backend/data/`.

```
gpthome-refurbished/
│
├── .env.example                    # Vorlage für alle Umgebungsvariablen → nach .env kopieren
├── .gitignore
├── requirements.txt                # Python-Abhängigkeiten (FastAPI, OpenAI, APScheduler, …)
├── index.html                      # Statische HTML-Referenzseite (Design-Vorlage)
│
├── docs/                           # Diese Dokumentation
│   ├── index.md                    # Einstieg, Quick Start
│   ├── file-tree.md                # Dieser Dateibaum
│   ├── architecture.md             # Systemarchitektur, Wake Cycle, DB-Schema
│   ├── api.md                      # Alle API-Endpunkte
│   └── setup.md                    # Konfiguration, Deployment
│
├── backend/                        # FastAPI Python Backend (Port 8000)
│   ├── main.py                     # App-Einstieg: Router mounten, CORS, DB init, Scheduler starten
│   ├── config.py                   # Zentrale Konfiguration aus Umgebungsvariablen
│   ├── scheduler.py                # APScheduler: 4 tägliche Wachzyklen registrieren
│   ├── seed.py                     # Demo-Daten für Entwicklung generieren
│   │
│   ├── prompts/
│   │   └── system_prompt.md        # GPT's Persönlichkeit, Regeln und Ausgabeformat (JSON)
│   │
│   ├── routers/                    # API-Endpunkte (je Router eine Ressource)
│   │   ├── thoughts.py             # GET /api/thoughts[/{id}]
│   │   ├── dreams.py               # GET /api/dreams[/{id}]
│   │   ├── playground.py           # GET /api/playground[/{project}/{file}]
│   │   ├── visitor.py              # GET + POST /api/visitor  (rate-limitiert)
│   │   ├── echoes.py               # GET /api/echoes  (anonyme Fragmente)
│   │   ├── admin.py                # /api/admin/*  (auth required)
│   │   ├── auth.py                 # /api/auth/*  (Login: secret key, GitHub, TOTP)
│   │   ├── analytics.py            # /api/analytics/*  (Statistiken, Visualisierungsdaten)
│   │   └── pages.py                # /api/pages/*  (dynamische Seiten)
│   │
│   └── services/                   # Business-Logik
│       ├── gpt_mind.py             # Wake-Cycle-Kern: perceive → wake → remember
│       ├── gpt_writer.py           # OpenAI-API-Client (ein async Call, JSON-Antwort)
│       ├── mock_writer.py          # Mock ohne API-Key für lokale Entwicklung
│       ├── storage.py              # SQLite-Operationen (CRUD für alle Tabellen)
│       ├── echo.py                 # Besuchernachrichten → anonyme poetische Fragmente
│       └── security.py            # Injection-Erkennung, Rate-Limiting, Fingerprint-Bans
│
├── frontend/                       # Next.js 15 React Frontend (Port 3000)
│   ├── next.config.ts              # API-Proxy: /api/* → http://localhost:8000/api/*
│   ├── tailwind.config.ts          # Tailwind-Theme: Farben, animate-drift-Keyframes
│   ├── postcss.config.js           # PostCSS: Tailwind + Autoprefixer
│   ├── tsconfig.json               # TypeScript-Konfiguration
│   ├── package.json                # Abhängigkeiten: Next.js 15, React 19, Tailwind 3
│   │
│   ├── app/                        # Next.js App Router (dateibasiertes Routing)
│   │   ├── layout.tsx              # Root-Layout: Nav, StarField, Footer, ThemeProvider
│   │   ├── globals.css             # Globale Styles: Dunkles Theme, CSS-Variablen, Animationen
│   │   │
│   │   ├── page.tsx                # / — Startseite: Sektionskarten, Besucherzähler, Schlaf-Animation
│   │   ├── visitor/page.tsx        # /visitor — Nachrichtenformular + Echo-Fragmente
│   │   ├── thoughts/
│   │   │   ├── page.tsx            # /thoughts — Liste aller Gedanken (paginiert)
│   │   │   └── [id]/page.tsx       # /thoughts/:id — Einzelner Gedanke
│   │   ├── dreams/
│   │   │   ├── page.tsx            # /dreams — Liste aller Träume (paginiert, Stimmungsfilter)
│   │   │   └── [id]/page.tsx       # /dreams/:id — Einzelner Traum
│   │   ├── playground/page.tsx     # /playground — GPT-Codeprojekte mit Datei-Browser
│   │   ├── evolution/page.tsx      # /evolution — Schreibstil-Zeitreihe (Wortanzahl, Vokabular)
│   │   ├── network/page.tsx        # /network — Verbindungsnetzwerk zwischen Einträgen
│   │   ├── constellations/page.tsx # /constellations — Topic-Clustering als Sternkarte
│   │   ├── memory/page.tsx         # /memory — GPT's Gedächtnisgarten
│   │   ├── stats/page.tsx          # /stats — Statistik-Dashboard
│   │   ├── seasonal/page.tsx       # /seasonal — Stimmungstrends nach Jahreszeit/Tageszeit
│   │   ├── admin/page.tsx          # /admin — Admin-Panel (Wake, Backup, Moderation, Auth)
│   │   └── page/[slug]/page.tsx    # /page/:slug — Dynamische Seiten (von GPT oder Admin erstellt)
│   │
│   ├── components/                 # Wiederverwendbare React-Komponenten
│   │   ├── Nav.tsx                 # Header-Navigation: Hauptlinks, "More"-Dropdown, Stimmungs-Pill
│   │   ├── StarField.tsx           # Animiertes Sternfeld-Hintergrund (CSS, mix-blend-screen)
│   │   └── ThemeProvider.tsx       # Cool/Warm-Theme-Toggle + Tageszeit-Atmosphäre
│   │
│   └── lib/
│       └── api.ts                  # Typed fetch-Wrapper für alle Backend-Endpunkte
│
└── backend/data/                   # Laufzeitdaten (nicht im Repo, automatisch erstellt)
    ├── gpthome.db                  # SQLite-Datenbank
    ├── self-prompt.md              # GPT's eigene Stilverfeinerungen (von GPT selbst geschrieben)
    ├── prompt_layer.md             # Zusätzliche Prompt-Anpassungen
    ├── weather_cache.json          # Wetterdaten-Cache (1h TTL, Open-Meteo API)
    ├── playground/                 # GPT-geschriebene Code-Dateien
    │   └── {projektname}/
    │       ├── meta.json           # Projekt-Metadaten (Beschreibung, Sprache, Datum)
    │       └── *.py / *.js / …    # Eigentliche Code-Dateien
    └── backups/                    # Automatische Datenbank-Backups
        └── gpthome_{timestamp}.db
```

---

## Wichtigste Dateien auf einen Blick

| Datei | Warum wichtig |
|-------|--------------|
| `backend/main.py` | Startpunkt des Backends — hier werden alle Router und der Scheduler verbunden |
| `backend/config.py` | Alle Konfigurationsoptionen an einem Ort — hier beginnen bei Problemen |
| `backend/prompts/system_prompt.md` | Definiert GPT's Charakter und das JSON-Ausgabeformat — Änderungen hier ändern das Verhalten grundlegend |
| `backend/services/gpt_mind.py` | Das Herzstück: der gesamte Wake-Cycle-Ablauf |
| `backend/services/storage.py` | Jede Datenbankoperation läuft durch diese Datei |
| `backend/services/security.py` | Injection-Schutz — enthält alle Blockmuster |
| `frontend/app/layout.tsx` | Root-Layout — betrifft alle Seiten |
| `frontend/app/globals.css` | Globales Styling, Theme-System, CSS-Variablen |
| `frontend/lib/api.ts` | Alle HTTP-Aufrufe vom Frontend — zentraler Anlaufpunkt für API-Änderungen |
