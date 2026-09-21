from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Any

# PRD §19 freezes the core shape. The detection engine adds fields on top
# (confidence, attribution, incidents, capture coverage), so the response models
# validate the frozen keys and pass the rest through instead of silently
# dropping them on the way out.
_PASSTHROUGH = ConfigDict(extra="allow")

class Flow(BaseModel):
    model_config = _PASSTHROUGH

    flow_id: str
    timestamp: datetime
    source_ip: str
    destination_ip: str
    source_port: int | None = None
    destination_port: int | None = None
    transport: str
    application: str
    packets: int = Field(ge=0)
    bytes: int = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    ndpi_risks: list[str] = []
    metadata: dict[str, Any] = {}

class DetectionAlert(BaseModel):
    model_config = _PASSTHROUGH

    alert_id: str
    flow_id: str
    rule_ids: list[str]
    title: str
    severity: str
    risk_score: int = Field(ge=0, le=100)
    evidence: list[str]
    created_at: datetime
    status: str = "open"

class AIAnalysis(BaseModel):
    threat_category: str
    severity: str
    confidence: float = Field(ge=0, le=1)
    summary: str
    observed_evidence: list[str]
    recommendations: list[str]
    caveats: list[str]

class DashboardSummary(BaseModel):
    model_config = _PASSTHROUGH

    total_flows: int
    suspicious_flows: int
    high_risk: int
    protocols: int
    risk_distribution: dict[str, int]
    protocol_distribution: dict[str, int]
    recent_alerts: list[DetectionAlert]

class AnalysisJob(BaseModel):
    job_id: str
    filename: str
    status: str
    message: str
    summary: DashboardSummary | None = None
