"""Pydantic schemas for all AI layer inputs and outputs.

Every provider driver and every API endpoint use these models so the response
shape stays identical regardless of which provider is active (mock / Claude /
OpenAI / Gemini / Ollama).
"""
from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Alert explain  (/api/alerts/{id}/explain)
# ---------------------------------------------------------------------------

class AlertExplainResponse(BaseModel):
    provider: str = Field(description="Which AI provider produced this response")
    threat_category: str
    severity: str
    confidence: float = Field(ge=0.0, le=1.0)
    observed_evidence: list[str]
    # Narrative fields written by the AI
    summary: str
    recommendations: list[str]
    caveats: list[str]
    # Optional extra detail from capable models
    technical_findings: list[str] = Field(default_factory=list)
    investigation_steps: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# AI Q&A  (/api/ai/ask)
# ---------------------------------------------------------------------------

class AIAskRequest(BaseModel):
    question: str


class AIAskResponse(BaseModel):
    provider: str
    answer: str
    evidence: list[str]
    follow_up_questions: list[str] = Field(default_factory=list)
    tool_calls_made: list[str] = Field(
        default_factory=list,
        description="Tools the SOC agent called while formulating this answer",
    )


# ---------------------------------------------------------------------------
# Incident Report  (/api/ai/report)
# ---------------------------------------------------------------------------

class ReportRequest(BaseModel):
    title: str = "NetSentinel Incident Report"
    include_flows: bool = False


class ReportResponse(BaseModel):
    provider: str
    title: str
    executive_summary: str
    key_risk_factors: list[str]
    top_threats: list[dict[str, Any]]
    incident_timeline: list[str]
    remediation_steps: list[str]
    overall_severity: str
    confidence: float = Field(ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Provider info  (/api/ai/providers)
# ---------------------------------------------------------------------------

class ProviderInfo(BaseModel):
    name: str
    active: bool
    healthy: bool
    model: str | None = None
    description: str = ""


class ProviderListResponse(BaseModel):
    active_provider: str
    providers: list[ProviderInfo]


class ProviderSwitchRequest(BaseModel):
    provider: str = Field(description="One of: mock, claude, openai, gemini, ollama")
