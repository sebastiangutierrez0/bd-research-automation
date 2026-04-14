"""
Tavily web search — all Tavily API usage is isolated here.
"""

import os
from typing import Any

import httpx


TAVILY_SEARCH_URL = "https://api.tavily.com/search"


def search_web(query: str, max_results: int = 8) -> dict[str, Any]:
    """
    Run a Tavily search and return the parsed JSON response.
    """
    # TODO: Add your Tavily API key to the .env file as TAVILY_API_KEY=...
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise ValueError(
            "TAVILY_API_KEY is not set. Add it to backend/.env (see TODO in search_client.py)."
        )

    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "include_answer": True,
        "max_results": max_results,
    }

    with httpx.Client(timeout=60.0) as client:
        response = client.post(TAVILY_SEARCH_URL, json=payload)
        response.raise_for_status()
        return response.json()


def format_search_results_for_prompt(tavily_json: dict[str, Any]) -> str:
    """
    Turn Tavily JSON into a readable block for the LLM prompt.
    """
    lines: list[str] = []

    answer = tavily_json.get("answer")
    if answer:
        lines.append(f"Summary: {answer}")
        lines.append("")

    results = tavily_json.get("results") or []
    for i, item in enumerate(results, start=1):
        title = item.get("title") or "Untitled"
        url = item.get("url") or ""
        content = (item.get("content") or "").strip()
        lines.append(f"[{i}] {title}")
        if url:
            lines.append(f"URL: {url}")
        if content:
            lines.append(content)
        lines.append("")

    if not lines:
        return "No search results returned."
    return "\n".join(lines).strip()
