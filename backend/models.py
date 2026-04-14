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
