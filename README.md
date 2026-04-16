# BD Research Automation

Web app for an investment firm’s Business Development team: describe an outreach effort and target (institutional investor or company), run automated web research (Tavily), generate a brief and outreach email (Claude), and log runs to Airtable. Supports **bulk research** (many targets, one campaign) with a Server-Sent Events stream, and optional **Make** webhooks to trigger email or other automation after each successful generation.

**Stack:** React + TypeScript + Tailwind (Vite) · FastAPI · Tavily · Anthropic Claude · Airtable · optional [Make](https://www.make.com) (HTTP webhook)

| Area | Path | Dev URL |
|------|------|---------|
| Frontend | `frontend/` | http://localhost:3000 |
| Backend | `backend/` | http://localhost:8000 |

**Repo:** `docker-compose.yml` (API + nginx-served UI), `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` (SPA fallback).

---

## Prerequisites

- **Node.js** 18+, **Python** 3.11+ (3.12 recommended if wheels fail on newer Python)
- API keys: [Anthropic Console](https://console.anthropic.com/settings/keys) (Claude), [Tavily](https://tavily.com), [Airtable](https://airtable.com) (token + base + table)

---

## Quick start (local)

**Backend** — from `backend/`:

```bash
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Copy and fill `backend/.env` (see [Environment](#environment)). Run the API from **`backend`** (where `main.py` lives):

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

On Windows, `run.bat` / `run.ps1` in `backend/` do the same. Prefer `python -m uvicorn` so the venv’s Python is used.

**Frontend** — from repo root:

```bash
npm run setup && npm run dev
```

Or `cd frontend && npm install && npm run dev`.

Optional: `VITE_API_BASE` (e.g. `http://localhost:8000`) if the API is not on the default the app expects.

Health: [http://localhost:8000/health](http://localhost:8000/health)

---

## Environment (`backend/.env`)

**Required**

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude |
| `TAVILY_API_KEY` | Web search |
| `AIRTABLE_API_KEY` | Personal access token (`data.records:read` + `write`) |
| `AIRTABLE_BASE_ID` | Base ID (Airtable API docs for your base) |
| `AIRTABLE_TABLE_NAME` | Table tab name |
| `BD_SIGNATORY_NAME` | Email sign-off name |
| `BD_FIRM_NAME` | Firm name in sign-off |

**Optional**

| Variable | Purpose |
|----------|---------|
| `MAKE_WEBHOOK_URL` | HTTPS URL of a Make (or any service that accepts JSON POSTs) **webhook module**. When set, the API POSTs a small JSON payload after each **successful** research: once for `POST /research`, and once per successful target in `POST /bulk-research`. Payload fields: `target_name`, `target_type`, `outreach_effort`, `timestamp` (ISO 8601 UTC). Leave unset to disable. |

The model name is set in code (`backend/ai_client.py`); no extra AI provider environment variables are required beyond `ANTHROPIC_API_KEY`.

Do not commit real secrets. The app uses one Claude call per generate (brief + email together) via `claude-sonnet-4-5` in `backend/ai_client.py`.

---

## Airtable (CRM log)

1. Create a base and a table (e.g. **Research Log**).
2. Field **names must match exactly**:

| Column | Type |
|--------|------|
| Timestamp | Date/time or single line text (ISO 8601) |
| Target Name | Single line text |
| Target Type | Single line text (`Institutional Investor` / `Target Company`) |
| Brief | Long text |
| Email | Long text |
| Outreach Effort | Single line text |
| Outreach Context | Long text (optional per run) |

3. Token: [airtable.com/create/tokens](https://airtable.com/create/tokens). Set `AIRTABLE_TABLE_NAME` to the tab name.

The UI can attach **.pdf** / **.docx**; text is extracted in the browser into **Outreach Context**. Older rows without **Outreach Effort** may show as **(Uncategorized)** in history.

---

## API

| Method | Path | Description |
|--------|------|---------------|
| `GET` | `/health` | `{"status":"ok"}` |
| `GET` | `/history` | Records grouped by **Outreach Effort** (recent first); entries include `outreach_context` when stored |
| `POST` | `/research` | Body: `outreach_effort`, `target_name`, `target_type`; optional `outreach_context`. Search + one Claude call + Airtable; returns `brief`, `email`. If `MAKE_WEBHOOK_URL` is set, notifies the webhook after success. |
| `POST` | `/bulk-research` | Multiple targets; SSE stream (`progress`, `result`, `error`, `done`). Same campaign fields as `/research` plus `targets` list. Notifies the webhook after each successful target when `MAKE_WEBHOOK_URL` is set. Final `done` event carries a bulk summary (`outreach_effort`, `total_targets`, `target_names`, `timestamp`). |
| `POST` | `/notify` | Accepts that bulk summary payload (same JSON as the final SSE `done` event) for external automation (e.g. a flow that emails a recap). Does not send email by itself — secure before exposing publicly |

---

## Docker

[Docker](https://docs.docker.com/get-docker/) with Compose. From repo root:

```bash
docker compose up --build
```

- UI: http://localhost:3000 · API: http://localhost:8000  
- Put secrets in **`backend/.env`** (loaded when present), including optional `MAKE_WEBHOOK_URL` if you use Make.  
- Build-time `VITE_API_BASE` for a non-default API URL, e.g.  
  `$env:VITE_API_BASE="https://api.example.com"; docker compose up --build`  
- CORS for the API is configured in `backend/main.py` (e.g. `http://localhost:3000`); adjust `allow_origins` if the UI is hosted elsewhere.

---

## Flow

**Single target**

1. `POST /research` with effort, target, optional context.  
2. Backend: Tavily for the **target**, then **one** Claude call (`generate_brief_and_email` in `ai_client.py`) using context + search results; write Airtable row; optionally POST to `MAKE_WEBHOOK_URL`.  
3. Frontend refreshes history via `GET /history`.  

**Bulk**

1. `POST /bulk-research` with shared effort, context, and a `targets` list.  
2. Backend runs the same pipeline per target (with a short delay between targets), streams SSE, fires the Make webhook after each success, then emits `done` with a summary (also logged server-side).  
3. A separate client or automation can `POST` that summary to `/notify` if you want a server-side hook for end-of-run actions.

To swap Claude for another provider, update `backend/ai_client.py`.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Windows: `uvicorn` not found | Use `python -m uvicorn` with venv activated, or `backend/run.ps1` |
| Windows: `python` not found | `py -3 -m venv .venv`; disable Store **App execution aliases** for `python.exe` / `python3.exe`; reinstall with “Add to PATH” |
| `pip install` fails on `pydantic-core` / missing `link.exe` | Often Python 3.14 + old pydantic; this repo pins `pydantic>=2.13.0`. If it still builds from source, use Python 3.12 and recreate the venv |
| `npm` ENOENT for `package.json` | Run commands from `frontend/` or use `npm run setup` / `npm run dev` from repo root |

---

## Security

- Keep `backend/.env` out of version control (see `.gitignore`).  
- Load secrets via environment / dotenv, not hard-coded keys.  
- `MAKE_WEBHOOK_URL` can trigger downstream automation; treat it like a secret and restrict who can change your Make scenario.
