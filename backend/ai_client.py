"""
AI text generation via Anthropic Claude (anthropic).

Claude is now the active provider for this module and Gemini has been removed.
"""

from __future__ import annotations

import os
import re

import anthropic


def _response_to_text(response: object) -> str:
    content = getattr(response, "content", None)
    if not content:
        raise RuntimeError("Claude returned no content for the prompt.")

    parts: list[str] = []
    for block in content:
        btext = getattr(block, "text", None)
        if btext:
            parts.append(btext)

    if not parts:
        raise RuntimeError("Claude returned no text content.")
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
    # TODO: Add your Claude API key to backend/.env as ANTHROPIC_API_KEY=...
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env (see TODO in ai_client.py)."
        )

    client = anthropic.Anthropic(api_key=api_key)
    prompt = _build_combined_prompt(
        target_name,
        search_blob,
        signatory_name,
        firm_name,
        outreach_context,
    )

    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = _response_to_text(response)
    return _parse_brief_and_email(raw)


def generate_content(prompt: str) -> str:
    # TODO: Add your Claude API key to backend/.env as ANTHROPIC_API_KEY=...
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env (see TODO in ai_client.py)."
        )

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    return _response_to_text(response)
