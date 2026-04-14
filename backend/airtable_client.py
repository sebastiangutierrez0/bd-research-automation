"""
Airtable CRM logging — all Airtable API usage is isolated here.
"""

import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from pyairtable import Api


def _get_table():
    # TODO: Add your Airtable personal access token to backend/.env as AIRTABLE_API_KEY=...
    api_key = os.getenv("AIRTABLE_API_KEY")
    if not api_key:
        raise ValueError(
            "AIRTABLE_API_KEY is not set. Add it to backend/.env (see TODO in airtable_client.py)."
        )

    # TODO: Add your Airtable base ID to backend/.env as AIRTABLE_BASE_ID=...
    base_id = os.getenv("AIRTABLE_BASE_ID")
    if not base_id:
        raise ValueError(
            "AIRTABLE_BASE_ID is not set. Add it to backend/.env (see TODO in airtable_client.py)."
        )

    # TODO: Add your Airtable table name to backend/.env as AIRTABLE_TABLE_NAME=...
    table_name = os.getenv("AIRTABLE_TABLE_NAME")
    if not table_name:
        raise ValueError(
            "AIRTABLE_TABLE_NAME is not set. Add it to backend/.env (see TODO in airtable_client.py)."
        )

    api = Api(api_key)
    return api.table(base_id, table_name)


def log_to_airtable(
    *,
    target_name: str,
    target_type: str,
    brief: str,
    email: str,
    outreach_effort: str,
    outreach_context: str,
) -> None:
    """
    Append one record: Timestamp, Target Name, Target Type, Brief, Email,
    Outreach Effort, Outreach Context.
    Field names must match your Airtable table columns exactly.
    """
    ts = datetime.now(timezone.utc).isoformat()

    table = _get_table()
    table.create(
        {
            "Timestamp": ts,
            "Target Name": target_name,
            "Target Type": target_type,
            "Brief": brief,
            "Email": email,
            "Outreach Effort": outreach_effort,
            "Outreach Context": outreach_context or "",
        }
    )


def _parse_ts_for_sort(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return 0.0
    return 0.0


def get_history_grouped() -> list[dict[str, Any]]:
    """
    Fetch all records and return groups: [{ "outreach_effort": str, "entries": [...] }, ...]
    Groups are ordered by most recent activity first (max timestamp in group).
    Entries within each group are newest first.
    """
    table = _get_table()
    records = table.all()

    by_effort: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for rec in records:
        rid = rec.get("id") or ""
        fields = rec.get("fields") or {}
        effort_raw = fields.get("Outreach Effort")
        effort = (
            str(effort_raw).strip()
            if effort_raw is not None
            else ""
        )
        if not effort:
            effort = "(Uncategorized)"

        ts_raw = fields.get("Timestamp")
        ts_str = (
            str(ts_raw)
            if ts_raw is not None
            else ""
        )

        entry = {
            "id": rid,
            "target_name": str(fields.get("Target Name") or ""),
            "target_type": str(fields.get("Target Type") or ""),
            "timestamp": ts_str,
            "brief": str(fields.get("Brief") or ""),
            "email": str(fields.get("Email") or ""),
            "outreach_context": str(fields.get("Outreach Context") or ""),
        }
        by_effort[effort].append(entry)

    for effort_entries in by_effort.values():
        effort_entries.sort(
            key=lambda e: _parse_ts_for_sort(e.get("timestamp")),
            reverse=True,
        )

    groups: list[dict[str, Any]] = []
    for effort, entries in by_effort.items():
        max_ts = 0.0
        for e in entries:
            max_ts = max(max_ts, _parse_ts_for_sort(e.get("timestamp")))
        groups.append(
            {
                "outreach_effort": effort,
                "entries": entries,
                "_sort_key": max_ts,
            }
        )

    groups.sort(key=lambda g: g["_sort_key"], reverse=True)
    for g in groups:
        del g["_sort_key"]

    return groups
