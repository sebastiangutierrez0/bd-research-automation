"""
AI text generation via Google Gemini (google-generativeai).

SWAPPING TO CLAUDE (Anthropic):
--------------------------------
1. Remove or stop importing `google.generativeai` and remove `google-generativeai`
   from requirements.txt; add `anthropic` instead.
2. Replace the implementation of `generate_content(prompt: str) -> str` below to
   call Anthropic's Messages API (e.g. `anthropic.Anthropic().messages.create(...)`)
   with your chosen Claude model.
3. Read the API key from an environment variable such as `ANTHROPIC_API_KEY` using
   `os.getenv()`, with a TODO comment next to it — do not hardcode keys.
4. Map the Claude response text to a plain `str` return value so callers in `main.py`
   stay unchanged.
5. Optionally rename this file to `ai_client.py` still, or keep the same module name
   so `main.py` imports do not need to change beyond the internal implementation.

The rest of the app (Tavily search, Airtable logging, FastAPI routes) should remain the same.

FREE TIER: This module uses one generate_content call per research run (brief + email in one
response) and spaces out Gemini calls using GEMINI_MIN_SECONDS_BETWEEN_CALLS (default 12s)
to stay within typical free-tier per-minute limits.
"""

from __future__ import annotations

import os
import re
import threading
import time

import google.generativeai as genai

try:
    from google.api_core import exceptions as google_api_exceptions
except ImportError:
    google_api_exceptions = None  # type: ignore[assignment]

_lock = threading.Lock()
_last_gemini_monotonic: float = 0.0


def _is_quota_or_rate_limit(exc: BaseException) -> bool:
    if google_api_exceptions is not None:
        if isinstance(
            exc,
            (
                google_api_exceptions.ResourceExhausted,
                google_api_exceptions.TooManyRequests,
            ),
        ):
            return True
    msg = str(exc).lower()
    return (
        "429" in msg
        or "quota" in msg
        or "rate limit" in msg
        or "resource exhausted" in msg
    )


def _retry_delay_seconds(exc: BaseException) -> float:
    msg = str(exc)
    m = re.search(r"retry in ([\d.]+)\s*s", msg, re.I)
    if m:
        return min(float(m.group(1)) + 0.25, 120.0)
    m = re.search(r"retry_delay\s*\{[^}]*seconds:\s*(\d+)", msg)
    if m:
        return min(float(m.group(1)) + 0.25, 120.0)
    return 2.0


def _throttle_free_tier_spacing() -> None:
    """
    Space out Gemini generate_content calls. Free tier is often ~5 requests/minute per model;
    12s between calls keeps a safe margin. Set GEMINI_MIN_SECONDS_BETWEEN_CALLS=0 to disable.
    """
    # TODO: Optional — tune in backend/.env (default 12 keeps under ~5 RPM free tier)
    raw = os.getenv("GEMINI_MIN_SECONDS_BETWEEN_CALLS", "12")
    try:
        min_seconds = float(raw)
    except ValueError:
        min_seconds = 12.0
    if min_seconds <= 0:
        return

    global _last_gemini_monotonic
    with _lock:
        now = time.monotonic()
        wait = min_seconds - (now - _last_gemini_monotonic)
        if wait > 0:
            time.sleep(wait)
        _last_gemini_monotonic = time.monotonic()


def _response_to_text(response: object) -> str:
    if not getattr(response, "candidates", None):
        raise RuntimeError("Gemini returned no candidates for the prompt.")

    text = getattr(response, "text", None)
    if text:
        return text.strip()

    parts: list[str] = []
    for cand in response.candidates:
        content = getattr(cand, "content", None)
        if not content:
            continue
        for part in getattr(content, "parts", []) or []:
            ptext = getattr(part, "text", None)
            if ptext:
                parts.append(ptext)
    if not parts:
        raise RuntimeError("Gemini returned no text content.")
    return "\n".join(parts).strip()


def _parse_brief_and_email(raw: str) -> tuple[str, str]:
    brief_m = re.search(
        r"---BEGIN BRIEF---\s*(.*?)\s*---END BRIEF---",
        raw,
        re.DOTALL | re.IGNORECASE,
    )
    email_m = re.search(
        r"---BEGIN EMAIL---\s*(.*?)\s*---END EMAIL---",
        raw,
        re.DOTALL | re.IGNORECASE,
    )
    if not brief_m or not email_m:
        raise ValueError(
            "Gemini response did not include the required ---BEGIN BRIEF--- / ---BEGIN EMAIL--- "
            "sections. Try again or shorten the search context."
        )
    brief = brief_m.group(1).strip()
    email = email_m.group(1).strip()
    if not brief or not email:
        raise ValueError("Brief or email section was empty after parsing.")
    return brief, email


def _build_combined_prompt(
    target_name: str,
    search_blob: str,
    signatory_name: str,
    firm_name: str,
    outreach_context: str,
) -> str:
    ctx_block = (
        outreach_context.strip()
        if outreach_context.strip()
        else "No additional campaign context was provided."
    )
    return f"""You will produce TWO sections in ONE answer. Use EXACTLY these markers and nothing else around the content:

---BEGIN BRIEF---
(your full intelligence brief goes here)
---END BRIEF---
---BEGIN EMAIL---
(your full outreach email goes here)
---END EMAIL---

OUTREACH CAMPAIGN CONTEXT (from our BD team — use together with web search to frame mandate, fund or product story, timing, and how this target fits the outreach; do not invent facts not supported by search results or this context):
{ctx_block}

SECTION A — Intelligence brief (content between the BRIEF markers only):
You are a senior research analyst at an investment firm. Based on the OUTREACH CAMPAIGN CONTEXT above and the following web search results about {target_name}, write a concise one-page intelligence brief. Include: firm overview, AUM or revenue, key people, recent news, investment or business focus, and why this target is relevant for a business development conversation given our campaign goals. Be factual, specific, and professional — ground claims in the search results; use the campaign context only where it aligns and does not contradict facts.

Search results:
{search_blob}

SECTION B — Outreach email (content between the EMAIL markers only):
You are a senior BD professional at an investment firm. Using the intelligence brief you wrote in SECTION A and the OUTREACH CAMPAIGN CONTEXT, draft a short personalized outreach email. The email should: be under 150 words, reference one specific real detail from the brief, reflect the campaign context where appropriate, have a clear subject line, and end with a soft call to action (a 15-minute call). Sign off as {signatory_name} from {firm_name}.
"""


def generate_brief_and_email(
    target_name: str,
    search_blob: str,
    signatory_name: str,
    firm_name: str,
    outreach_context: str = "",
) -> tuple[str, str]:
    """
    One Gemini generate_content call: brief + email, formatted for free-tier limits.
    """
    # TODO: Add your Gemini API key to the .env file as GEMINI_API_KEY=...
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see TODO in ai_client.py)."
        )

    genai.configure(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    model = genai.GenerativeModel(model_name)

    prompt = _build_combined_prompt(
        target_name,
        search_blob,
        signatory_name,
        firm_name,
        outreach_context,
    )

    _throttle_free_tier_spacing()

    max_attempts = int(os.getenv("GEMINI_MAX_RETRIES", "6"))
    attempt = 0
    last_exc: BaseException | None = None

    while attempt < max_attempts:
        try:
            response = model.generate_content(prompt)
            raw = _response_to_text(response)
            return _parse_brief_and_email(raw)
        except Exception as e:
            last_exc = e
            if isinstance(e, ValueError) and "required" in str(e).lower():
                raise
            if not _is_quota_or_rate_limit(e):
                raise
            attempt += 1
            if attempt >= max_attempts:
                break
            delay = _retry_delay_seconds(e) * (1.2 ** (attempt - 1))
            delay = min(delay, 120.0)
            time.sleep(delay)

    assert last_exc is not None
    raise last_exc


def generate_content(prompt: str) -> str:
    """
    Single-prompt generation (legacy helper). Prefer generate_brief_and_email for /research
    to minimize API calls. Retries on 429 / quota errors.
    """
    # TODO: Add your Gemini API key to the .env file as GEMINI_API_KEY=...
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set. Add it to backend/.env (see TODO in ai_client.py)."
        )

    genai.configure(api_key=api_key)
    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    model = genai.GenerativeModel(model_name)

    _throttle_free_tier_spacing()

    max_attempts = int(os.getenv("GEMINI_MAX_RETRIES", "6"))
    attempt = 0
    last_exc: BaseException | None = None

    while attempt < max_attempts:
        try:
            response = model.generate_content(prompt)
            return _response_to_text(response)
        except Exception as e:
            last_exc = e
            if not _is_quota_or_rate_limit(e):
                raise
            attempt += 1
            if attempt >= max_attempts:
                break
            delay = _retry_delay_seconds(e) * (1.2 ** (attempt - 1))
            delay = min(delay, 120.0)
            time.sleep(delay)

    assert last_exc is not None
    raise last_exc
