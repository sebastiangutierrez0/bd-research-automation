from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ResearchRequest(BaseModel):
    target_name: str = Field(..., max_length=500)
    target_type: Literal["Institutional Investor", "Target Company"]
    outreach_effort: str = Field(..., max_length=500)
    outreach_context: str = Field(default="", max_length=32000)

    @field_validator("target_name")
    @classmethod
    def strip_target_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("target_name must not be empty")
        return stripped

    @field_validator("outreach_effort")
    @classmethod
    def strip_outreach_effort(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("outreach_effort must not be empty")
        return stripped

    @field_validator("outreach_context")
    @classmethod
    def normalize_outreach_context(cls, value: str) -> str:
        if not value:
            return ""
        return value.strip()


class ResearchResponse(BaseModel):
    brief: str
    email: str


class HistoryEntry(BaseModel):
    id: str
    target_name: str
    target_type: str
    timestamp: str
    brief: str
    email: str
    outreach_context: str = ""


class HistoryGroup(BaseModel):
    outreach_effort: str
    entries: list[HistoryEntry]


class HistoryResponse(BaseModel):
    groups: list[HistoryGroup]


class BulkResearchRequest(BaseModel):
    """Bulk run: same outreach effort and context (firm context) for every target."""

    targets: list[str] = Field(..., min_length=1, max_length=100)
    target_type: Literal["Institutional Investor", "Target Company"]
    outreach_effort: str = Field(..., max_length=500)
    outreach_context: str = Field(default="", max_length=32000)

    @field_validator("targets")
    @classmethod
    def normalize_targets(cls, value: list[str]) -> list[str]:
        out = [t.strip() for t in value if isinstance(t, str) and t.strip()]
        if not out:
            raise ValueError("at least one non-empty target is required")
        return out

    @field_validator("outreach_effort")
    @classmethod
    def strip_outreach_effort_bulk(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("outreach_effort must not be empty")
        return stripped

    @field_validator("outreach_context")
    @classmethod
    def normalize_outreach_context_bulk(cls, value: str) -> str:
        if not value:
            return ""
        return value.strip()


class BulkResearchSummary(BaseModel):
    """Sent as the final SSE event and accepted by POST /notify for Power Automate."""

    outreach_effort: str
    total_targets: int
    target_names: list[str]
    timestamp: str = Field(
        ...,
        description="ISO 8601 timestamp (UTC recommended)",
    )

    @field_validator("timestamp")
    @classmethod
    def parse_timestamp_ok(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("timestamp must not be empty")
        return value.strip()
