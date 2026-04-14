# BD Research Automation

Web application for an investment firm’s Business Development team: enter an outreach effort and target (institutional investor or company), run automated web research, generate an intelligence brief and outreach email via Gemini, and log results to Airtable.

## Repository layout

- `frontend/` — React + TypeScript + Tailwind (Vite), **http://localhost:3000**
- `backend/` — FastAPI + Tavily + Gemini + Airtable, **http://localhost:8000**

## Prerequisites

- **Node.js** 18+ (for the frontend)
- **Python** 3.11+ (for the backend)
- API accounts / keys:
  - [Google AI Studio](https://aistudio.google.com/apikey) — Gemini API key
  - [Tavily](https://tavily.com) — API key
  - [Airtable](https://airtable.com) — personal access token, base, and table (see below)

## Airtable setup (CRM logging)

1. Create a free Airtable account at [airtable.com](https://airtable.com).
2. Create a new base called **BD Research Automation** (or any name you prefer).
3. In that base, create a table (for example **Research Log**) with these columns — field names must match **exactly**:

   | Column name | Field type |
   |-------------|------------|
   | **Timestamp** | Date and time, or single line text (the app sends an ISO 8601 string) |
   | **Target Name** | Single line text |
   | **Target Type** | Single line text (values will be `Institutional Investor` or `Target Company`) |
   | **Brief** | Long text |
   | **Email** | Long text |
   | **Outreach Effort** | Single line text |
   | **Outreach Context** | Long text (campaign notes, fund details, goals — optional per run) |

4. **Manual step — required before running the app:** Ensure **Outreach Effort** (Single line text) exists. Add **Outreach Context** (Long text) so the app can store the optional context you type, paste, or load from extracted text (e.g. in the UI you can drag/drop **.pdf** or **.docx** or attach those files — text is extracted in the browser). The backend logs each run under the effort name and saves the context text when provided.

5. Get your **API key** from [airtable.com/create/tokens](https://airtable.com/create/tokens) (create a personal access token with `data.records:read` and `data.records:write` for the bases you need).

6. Get the **Base ID** from the [Airtable API documentation](https://airtable.com/developers/web/api/introduction) for your base (also shown when you open the API docs while viewing the base).

7. Set **AIRTABLE_TABLE_NAME** in `.env` to the table’s name as it appears in Airtable (the tab name).

8. Add `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and `AIRTABLE_TABLE_NAME` to `backend/.env` as described in the table below.

Records created without **Outreach Effort** in older data may appear under **(Uncategorized)** in the in-app history.

## Backend setup

1. Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
```

On Windows (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

On macOS/Linux:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

2. Configure environment variables in `backend/.env` (copy from the same file and fill in values — **never commit real secrets**):

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Gemini API key |
| `TAVILY_API_KEY` | Tavily search API key |
| `AIRTABLE_API_KEY` | Airtable personal access token |
| `AIRTABLE_BASE_ID` | Airtable base ID |
| `AIRTABLE_TABLE_NAME` | Table name (tab) in the base |
| `BD_SIGNATORY_NAME` | Name used in the outreach email sign-off |
| `BD_FIRM_NAME` | Firm name used in the outreach email sign-off |

Optional:

| Variable | Purpose |
|----------|---------|
| `GEMINI_MODEL` | Override model (default `gemini-2.5-flash`; older IDs like `gemini-1.5-flash` are retired) |
| `GEMINI_MAX_RETRIES` | Max retries for `429` / quota errors (default `6`) |
| `GEMINI_MIN_SECONDS_BETWEEN_CALLS` | Minimum seconds between Gemini requests (default `12`, helps stay under free-tier RPM; set `0` to disable spacing) |

**Gemini free tier:** The API enforces low per-minute limits on `generate_content`. This app uses **one** Gemini call per **Generate** (brief + outreach in a single Gemini response) and spaces calls with `GEMINI_MIN_SECONDS_BETWEEN_CALLS`. For higher throughput, see [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) and billing options in Google AI Studio.

3. Run the API.

**Important:** Use `python -m uvicorn` (or activate `.venv` first). A bare `uvicorn` command often fails on Windows with “not recognized” because the tool is only installed inside the virtual environment.

**Windows (easiest):** from the `backend` folder, double‑click `run.bat` **or** in PowerShell:

```powershell
cd backend
.\run.ps1
```

**Manual (all platforms):**

```bash
cd backend
python -m venv .venv
```

On **Windows**, if `python` is not recognized, use the Python launcher instead:

```powershell
cd backend
py -3 -m venv .venv
```

Windows PowerShell: `.\.venv\Scripts\Activate.ps1` — then `pip install -r requirements.txt` — then:

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

After the venv is activated, `python` should point at `.venv\Scripts\python.exe`. If it still does not, run uvicorn with the full path: `.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000`.

**Important:** Start the API from the **`backend`** folder (where `main.py` lives), not the repo root.

Health check: [http://localhost:8000/health](http://localhost:8000/health)

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{"status":"ok"}` if the server is running. |
| `GET` | `/history` | Returns all Airtable records grouped by **Outreach Effort**. Groups are ordered by most recent activity first; entries within each group are newest first. Each entry includes `outreach_context` when stored. Response shape: `{ "groups": [ { "outreach_effort": string, "entries": [ { "id", "target_name", "target_type", "timestamp", "brief", "email", "outreach_context" } ] } ] }`. |
| `POST` | `/research` | Body: `{ "outreach_effort", "outreach_context" (optional string), "target_name", "target_type" }`. Runs search + Gemini (brief and email use **outreach context** plus target web research) + Airtable log; returns `{ "brief", "email" }`. |

### Troubleshooting: `pip install` fails on `pydantic-core` / `link.exe` not found (Windows)

You are likely on **Python 3.14** with an older **pydantic** pin that has no prebuilt wheel yet, so pip tries to compile Rust/C++ and needs **Visual Studio Build Tools**. This repo pins **`pydantic>=2.13.0`** so wheels install on Python 3.14.

From `backend`, with the venv activated:

```powershell
pip install -r requirements.txt
```

If you still see build errors, install [Python 3.12](https://www.python.org/downloads/) and recreate the venv: `py -3.12 -m venv .venv`, then install again.

### Troubleshooting: “Python was not found” (Windows)

1. **Use the `py` launcher** (installed with Python from [python.org](https://www.python.org/downloads/)): run `py -3 --version`. If that works, create the venv with `py -3 -m venv .venv` and use `.\run.ps1` from `backend`, or activate the venv and run `python -m uvicorn ...` as above.
2. **App execution aliases** can hijack `python`: Settings → Apps → Advanced app settings → **App execution aliases** → turn **off** the aliases for `python.exe` and `python3.exe` (they open the Microsoft Store instead of your install). Then open a **new** terminal.
3. Re-run the installer and enable **“Add python.exe to PATH”**, or add your Python install folder and `Scripts` to the system PATH manually.

## Frontend setup

The React app lives in **`frontend/`** — `package.json` is there, not at the repo root. If `npm install` fails with **ENOENT / package.json not found**, you are in the wrong folder.

```bash
cd frontend
npm install
npm run dev
```

From the **repo root**, you can instead run:

```bash
npm run setup
npm run dev
```

The dev server listens on **http://localhost:3000** (configured in `vite.config.ts`).

Optional: point the UI at another API base URL:

```bash
# Windows PowerShell
$env:VITE_API_BASE="http://localhost:8000"; npm run dev
```

## How it works

1. The browser sends `POST /research` with `{ "outreach_effort": "...", "outreach_context": "..." (optional), "target_name": "...", "target_type": "Institutional Investor" | "Target Company" }`.
2. The backend calls Tavily for **target** research, then calls `generate_brief_and_email()` in `ai_client.py` **once** — the model receives **outreach context** (campaign / fund / goals) **and** web search results so the brief and email reflect both. It creates a record in Airtable (**Outreach Effort**, **Outreach Context**, brief, email, etc.) and returns `{ "brief", "email" }`.
3. The frontend loads and refreshes research history via `GET /history`.
4. To switch from Gemini to Claude later, follow the comment block at the top of `backend/ai_client.py` and replace only that module’s implementation.

## Security notes

- Keep `backend/.env` **out of git** (see root `.gitignore`).
- Do not embed API keys in source files; always use `os.getenv()` (or `.env` loaded via `python-dotenv`).
