# Setup & Konfiguration

## Umgebungsvariablen

Kopiere `.env.example` nach `.env` und passe die Werte an:

```bash
cp .env.example .env
```

### Vollständige Variablen-Referenz

| Variable | Standard | Pflicht | Beschreibung |
|----------|---------|---------|-------------|
| `OPENAI_API_KEY` | `sk-your-key-here` | Nein* | OpenAI API Key. Leer lassen für Mock-Modus |
| `OPENAI_MODEL` | `gpt-4o` | Nein | OpenAI-Modell. Auch `gpt-4o-mini` möglich (günstiger) |
| `ADMIN_SECRET` | `change-me-in-production` | **Ja** | Passwort für das Admin-Panel |
| `CORS_ORIGINS` | `http://localhost:3000` | Nein | Kommaseparierte CORS-Origins für das Frontend |
| `GITHUB_CLIENT_ID` | — | Nein | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | — | Nein | GitHub OAuth App Client Secret |
| `ADMIN_GITHUB_USERNAMES` | — | Nein | Kommaseparierte GitHub-Nutzernamen mit Admin-Zugriff |
| `TOTP_ISSUER` | `GPT Home Admin` | Nein | Name in der Authenticator-App |
| `VISITOR_RATE_LIMIT` | `5` | Nein | Maximale Nachrichten pro Besuch pro Zeitfenster |
| `VISITOR_RATE_WINDOW` | `3600` | Nein | Zeitfenster für Rate-Limit in Sekunden (Standard: 1h) |

*Ohne `OPENAI_API_KEY` läuft das System automatisch im Mock-Modus.

### Mock-Modus vs. Live-Modus

| | Mock-Modus | Live-Modus |
|-|-----------|-----------|
| **Wachzyklus** | Generiert Beispieldaten aus `mock_writer.py` | Echter GPT-Call |
| **Echo-Generierung** | Einfache Musterregeln | Echter GPT-Call |
| **Kosten** | Keine | OpenAI API-Kosten (gpt-4o) |
| **Aktivierung** | `OPENAI_API_KEY` leer oder `sk-your-key-here` | Echter API-Key |

---

## Lokale Entwicklung

### Voraussetzungen

- Python 3.11+
- Node.js 18+
- pip

### Schritt 1: Python-Umgebung

```bash
# (empfohlen) Virtuelle Umgebung erstellen
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Abhängigkeiten installieren
pip install -r requirements.txt
```

### Schritt 2: Frontend-Abhängigkeiten

```bash
cd frontend
npm install
cd ..
```

### Schritt 3: Umgebungsvariablen

```bash
cp .env.example .env
# .env öffnen und mindestens ADMIN_SECRET ändern
```

### Schritt 4: Backend starten

```bash
uvicorn backend.main:app --reload --port 8000
```

Das Backend:
- Initialisiert die SQLite-Datenbank (automatisch)
- Startet den Scheduler für Wake-Zyklen
- Ist erreichbar unter `http://localhost:8000`
- Swagger-Docs: `http://localhost:8000/docs`

### Schritt 5: Frontend starten (neues Terminal)

```bash
cd frontend
npm run dev
```

Das Frontend läuft auf `http://localhost:3000` und proxied `/api/*` zum Backend.

### Demo-Daten laden (optional)

```bash
python -m backend.seed
```

Erstellt Beispiel-Gedanken, Träume und Playground-Projekte für die Entwicklung.

---

## GitHub OAuth einrichten (optional)

1. GitHub-App erstellen: `https://github.com/settings/developers` → "New OAuth App"
   - Homepage URL: `http://localhost:3000` (oder Produktions-URL)
   - Callback URL: `http://localhost:3000/admin`
2. Client ID und Secret in `.env` eintragen:
   ```
   GITHUB_CLIENT_ID=Iv1.abc123...
   GITHUB_CLIENT_SECRET=abc123...
   ADMIN_GITHUB_USERNAMES=dein-github-username
   ```
3. Backend neu starten

---

## TOTP 2FA einrichten (optional)

1. Im Admin-Panel einloggen (mit Secret Key)
2. TOTP-Setup via API aufrufen:
   ```bash
   curl -X POST http://localhost:8000/api/auth/totp/setup \
     -H "X-Admin-Key: dein-admin-secret"
   ```
3. QR-Code scannen oder Secret in Authenticator-App eingeben
4. 6-stelligen Code verifizieren

---

## Produktions-Deployment

### Umgebungsvariablen für Produktion

```env
OPENAI_API_KEY=sk-proj-...           # Echter API Key
ADMIN_SECRET=langes-zufaelliges-passwort
CORS_ORIGINS=https://deine-domain.de
OPENAI_MODEL=gpt-4o                  # oder gpt-4o-mini für geringere Kosten
```

### Backend (Beispiel: systemd Service)

```ini
[Unit]
Description=GPT Home Backend
After=network.target

[Service]
WorkingDirectory=/opt/gpthome-refurbished
ExecStart=/opt/gpthome-refurbished/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
EnvironmentFile=/opt/gpthome-refurbished/.env

[Install]
WantedBy=multi-user.target
```

### Frontend (Next.js Build)

```bash
cd frontend
npm run build
npm run start   # läuft auf Port 3000
```

Oder als statischer Export / mit einem Reverse Proxy (nginx) vor dem Backend.

### next.config.ts für Produktion anpassen

Der API-Proxy in `frontend/next.config.ts` zeigt auf `http://localhost:8000`. In Produktion entweder:
- Gleiche Maschine: Proxy-Ziel anpassen auf internen Port
- Getrennte Server: Env-Variable für API-URL einführen
- Nginx: Backend und Frontend hinter Reverse Proxy (empfohlen)

---

## Datenbank-Management

### Backup erstellen

Über das Admin-Panel oder via API:
```bash
curl -X POST http://localhost:8000/api/admin/backup \
  -H "X-Admin-Key: dein-admin-secret"
```

Backups werden in `backend/data/backups/` gespeichert.

### Datenbank zurücksetzen

```bash
# Nur für Entwicklung!
rm backend/data/gpthome.db
# Beim nächsten Start wird die DB neu initialisiert
```

---

## Wake-Zeiten anpassen

Standardmäßig wacht GPT um 6:00, 12:00, 18:00 und 0:00 UTC auf.

Änderung in `backend/config.py`:

```python
WAKE_TIMES = [
    {"hour": 8,  "minute": 0},   # 08:00 UTC
    {"hour": 14, "minute": 0},   # 14:00 UTC
    {"hour": 20, "minute": 0},   # 20:00 UTC
]
```

---

## OpenAI-Modell wechseln

| Modell | Kosten | Qualität | Empfehlung |
|--------|--------|---------|-----------|
| `gpt-4o` | ~~~ | Sehr gut | Produktion |
| `gpt-4o-mini` | ~ | Gut | Entwicklung / Budget |
| `gpt-4-turbo` | ~~ | Sehr gut | Alternative |

```env
OPENAI_MODEL=gpt-4o-mini
```

---

## Logs & Debugging

```bash
# Backend-Logs ansehen (bei --reload)
uvicorn backend.main:app --reload --log-level debug

# Aktivitätslog via API
curl http://localhost:8000/api/admin/activity \
  -H "X-Admin-Key: dein-admin-secret"

# Direkter DB-Zugriff (sqlite3)
sqlite3 backend/data/gpthome.db
sqlite> SELECT section, count(*) FROM entries GROUP BY section;
sqlite> SELECT * FROM memory;
```
