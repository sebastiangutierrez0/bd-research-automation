import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx

from ai_client import generate_brief_and_email
from airtable_client import get_history_grouped, log_to_airtable
from models import (
    BulkResearchRequest,
    BulkResearchSummary,
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

BULK_DELAY_SECONDS = 3

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


def _execute_research(body: ResearchRequest) -> ResearchResponse:
    """
    Tavily → Gemini (brief + email) → Airtable log.
    Raises Exception on failure (used by bulk); /research maps to HTTPException.
    """
    query = _build_search_query(body.target_name, body.target_type)

    try:
        tavily_raw = search_web(query)
    except Exception as e:
        logger.exception("Tavily search failed")
        raise RuntimeError(f"Web search failed: {e!s}") from e

    search_blob = format_search_results_for_prompt(tavily_raw)

    signatory_name = os.getenv("BD_SIGNATORY_NAME", "Your Name")
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
        raise RuntimeError(f"Research generation failed: {e!s}") from e

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


def run_research_pipeline(body: ResearchRequest) -> ResearchResponse:
    """POST /research — same behavior as before, HTTP errors for API client."""
    try:
        result = _execute_research(body)
        _send_make_webhook(
            target_name=body.target_name,
            target_type=body.target_type,
            outreach_effort=body.outreach_effort,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _sse_chunk(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _send_make_webhook(
    target_name: str, target_type: str, outreach_effort: str, timestamp: str
) -> None:
    # TODO: Add MAKE_WEBHOOK_URL to backend/.env
    webhook_url = os.getenv("MAKE_WEBHOOK_URL")
    if not webhook_url:
        return

    payload = {
        "target_name": target_name,
        "target_type": target_type,
        "outreach_effort": outreach_effort,
        "timestamp": timestamp,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            client.post(webhook_url, json=payload).raise_for_status()
    except Exception as e:
        logger.warning("Make webhook notification failed: %s", e)


def _notify_bulk_complete_internal(summary: dict) -> None:
    """
    TODO: Power Automate — create a cloud flow that triggers when you need to email
    the bulk summary. Typical pattern: register an HTTP-triggered flow with a shared
    secret, then either (a) call that flow's webhook URL from here using an env var
    like POWER_AUTOMATE_WEBHOOK_URL, or (b) expose POST /notify publicly (with auth)
    and have a flow's "When an HTTP request is received" action match this payload,
    then send the summary email. This function is invoked at the end of bulk SSE and
    can duplicate the same payload as POST /notify.
    """
    logger.info("Bulk research summary: %s", summary)


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
    return run_research_pipeline(body)


@app.post("/bulk-research")
def bulk_research(body: BulkResearchRequest):
    """
    Process targets sequentially with BULK_DELAY_SECONDS between each.
    Streams Server-Sent Events: progress, result, error, done.
    """

    def event_stream():
        targets = body.targets
        total = len(targets)
        target_names_all = list(targets)

        for i, target_name in enumerate(targets):
            yield _sse_chunk(
                "progress",
                {
                    "target_name": target_name,
                    "index": i + 1,
                    "total": total,
                    "completed_so_far": i,
                },
            )

            req = ResearchRequest(
                target_name=target_name,
                target_type=body.target_type,
                outreach_effort=body.outreach_effort,
                outreach_context=body.outreach_context,
            )

            try:
                result = _execute_research(req)
                _send_make_webhook(
                    target_name=target_name,
                    target_type=body.target_type,
                    outreach_effort=body.outreach_effort,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
                yield _sse_chunk(
                    "result",
                    {
                        "target_name": target_name,
                        "brief": result.brief,
                        "email": result.email,
                    },
                )
            except Exception as e:
                yield _sse_chunk(
                    "error",
                    {"target_name": target_name, "message": str(e)},
                )
                logger.exception("Bulk target failed: %s", target_name)

            if i < total - 1:
                time.sleep(BULK_DELAY_SECONDS)

        summary = {
            "outreach_effort": body.outreach_effort,
            "total_targets": total,
            "target_names": target_names_all,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield _sse_chunk("done", summary)
        _notify_bulk_complete_internal(summary)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/notify")
def notify(summary: BulkResearchSummary):
    """
    Accepts the same summary payload as the final SSE `done` event.
    TODO: Power Automate — configure a flow to POST here when a bulk run completes
    (e.g. call this URL from an automation that watches your process, or invoke the
    flow from the client after receiving `done`). Secure this endpoint in production
    (API key header, Azure AD, etc.).
    """
    _notify_bulk_complete_internal(summary.model_dump())
    return {"ok": True}
