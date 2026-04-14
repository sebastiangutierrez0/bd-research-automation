import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ai_client import generate_brief_and_email
from airtable_client import get_history_grouped, log_to_airtable
from models import (
    HistoryEntry,
    HistoryGroup,
    HistoryResponse,
    ResearchRequest,
    ResearchResponse,
)
from search_client import format_search_results_for_prompt, search_web

# Load .env from backend directory whether uvicorn is started from repo root or backend/
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BD Research Automation", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _build_search_query(target_name: str, target_type: str) -> str:
    if target_type == "Institutional Investor":
        return (
            f"{target_name} institutional investor AUM portfolio strategy "
            f"leadership team recent news investments"
        )
    return (
        f"{target_name} company revenue business overview leadership "
        f"recent news industry focus"
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/history", response_model=HistoryResponse)
def history() -> HistoryResponse:
    """
    Return all research records from Airtable, grouped by Outreach Effort.
    Groups are ordered by most recent activity first; entries within a group are newest first.
    """
    try:
        raw_groups = get_history_grouped()
    except Exception as e:
        logger.exception("Failed to fetch history from Airtable")
        raise HTTPException(
            status_code=502, detail=f"Failed to load research history: {e!s}"
        ) from e

    groups = [
        HistoryGroup(
            outreach_effort=g["outreach_effort"],
            entries=[HistoryEntry(**e) for e in g["entries"]],
        )
        for g in raw_groups
    ]
    return HistoryResponse(groups=groups)


@app.post("/research", response_model=ResearchResponse)
def research(body: ResearchRequest) -> ResearchResponse:
    query = _build_search_query(body.target_name, body.target_type)

    try:
        tavily_raw = search_web(query)
    except Exception as e:
        logger.exception("Tavily search failed")
        raise HTTPException(status_code=502, detail=f"Web search failed: {e!s}") from e

    search_blob = format_search_results_for_prompt(tavily_raw)

    # TODO: Add your name to backend/.env as BD_SIGNATORY_NAME=...
    signatory_name = os.getenv("BD_SIGNATORY_NAME", "Your Name")
    # TODO: Add your firm to backend/.env as BD_FIRM_NAME=...
    firm_name = os.getenv("BD_FIRM_NAME", "Your Firm")

    try:
        brief, email = generate_brief_and_email(
            target_name=body.target_name,
            search_blob=search_blob,
            signatory_name=signatory_name,
            firm_name=firm_name,
            outreach_context=body.outreach_context,
        )
    except Exception as e:
        logger.exception("Research generation failed")
        raise HTTPException(
            status_code=502, detail=f"Research generation failed: {e!s}"
        ) from e

    try:
        log_to_airtable(
            target_name=body.target_name,
            target_type=body.target_type,
            brief=brief,
            email=email,
            outreach_effort=body.outreach_effort,
            outreach_context=body.outreach_context,
        )
    except Exception as e:
        logger.warning("Airtable logging failed (returning brief and email anyway): %s", e)

    return ResearchResponse(brief=brief, email=email)
