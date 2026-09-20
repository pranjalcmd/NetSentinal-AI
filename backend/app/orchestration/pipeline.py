"""End-to-end data orchestration pipeline.

Manages the full data ingestion flow:
  PCAP / JSON Fixtures
       │
       ▼  DPI Adapter (nDPI / Python-L7)
       │
       ▼  Flow Normalization
       │
       ▼  Dual Detection Engine (Rules + ML Forest → Fused Alerts)
       │
       ▼  Entity Graph & Topology Builder
       │
       ▼  In-Memory Store Population

Supports both:
  - Batch mode: process all flows at once (default)
  - Progress mode: report stage completion for real-time job tracking
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable

from detection.rules.basic import build_alert, evaluate_flow
from ml.detection_engine import DetectionEngine
from dpi.ndpi_adapter import NDPIAdapter
from backend.app.core.config import settings
from backend.app.services.store import store

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singleton engines (same pattern as analysis.py)
# ---------------------------------------------------------------------------
_adapter = NDPIAdapter()
_ml_engine = DetectionEngine(settings.model_path)

# Expose for backward compatibility with main.py imports
adapter = _adapter
ml_engine = _ml_engine

# ML label → display label
THREAT_LABELS = {
    "DNS_TUNNELING": "DNS Tunneling",
    "PORT_SCAN": "Port Scan",
    "DOS": "Denial of Service",
    "BOTNET": "Botnet C2",
    "BRUTE_FORCE": "Brute Force",
    "DATA_EXFILTRATION": "Data Exfiltration",
    "SUSPICIOUS_LEGACY_SERVICE": "Legacy Service",
    "SUSPICIOUS_TRAFFIC": "Suspicious Traffic",
    "BENIGN": "Benign",
}

# Pipeline stage names for progress reporting
STAGES = [
    "normalizing",
    "detecting",
    "ml_scoring",
    "fusing",
    "graph_building",
    "store_update",
]


class PipelineResult:
    """Holds the outcome of a single pipeline run."""

    def __init__(self) -> None:
        self.flow_count: int = 0
        self.alert_count: int = 0
        self.stage_timings: dict[str, float] = {}
        self.errors: list[str] = []
        self.summary: dict[str, Any] = {}
        self.started_at: float = time.monotonic()

    @property
    def elapsed_seconds(self) -> float:
        return round(time.monotonic() - self.started_at, 3)

    def to_dict(self) -> dict[str, Any]:
        return {
            "flow_count": self.flow_count,
            "alert_count": self.alert_count,
            "elapsed_seconds": self.elapsed_seconds,
            "stage_timings": self.stage_timings,
            "errors": self.errors,
            "summary": self.summary,
        }


def run_pipeline(
    flows: list[dict[str, Any]],
    progress_cb: Callable[[str, int, int], None] | None = None,
    reset_store: bool = True,
) -> PipelineResult:
    """
    Execute the full detection + graph pipeline on a list of normalised flows.

    Args:
        flows:        Pre-normalised flow dicts (from DPI adapter or fixture).
        progress_cb:  Optional callback(stage_name, current, total) for progress.
        reset_store:  Clear existing store data before populating (default True).

    Returns:
        PipelineResult with timing metrics and the computed summary.
    """
    result = PipelineResult()
    total = len(flows)

    if progress_cb:
        progress_cb("starting", 0, total)

    # ------------------------------------------------------------------ #
    # Stage 0: Reset store                                                #
    # ------------------------------------------------------------------ #
    t0 = time.monotonic()
    if reset_store:
        store.reset()
    result.stage_timings["reset"] = round(time.monotonic() - t0, 4)

    # ------------------------------------------------------------------ #
    # Stage 1: Normalize + dual detection per flow                        #
    # ------------------------------------------------------------------ #
    t1 = time.monotonic()
    valid_flows: list[dict[str, Any]] = []
    fused_alerts: list[dict[str, Any]] = []

    for i, flow in enumerate(flows):
        flow_id = flow.get("flow_id")
        if not flow_id:
            result.errors.append(f"Flow at index {i} missing flow_id — skipped")
            continue

        valid_flows.append(flow)
        store.flows[flow_id] = flow

        # Rule engine
        findings = evaluate_flow(flow)
        rule_alert = build_alert(flow, findings)

        # ML engine
        try:
            ml_result = _ml_engine.predict(flow)
        except Exception as exc:
            logger.warning("ML predict failed for %s: %r", flow_id, exc)
            ml_result = _heuristic_ml_fallback(flow)

        flow["ml_detection"] = ml_result

        # Fuse
        alert = _fuse(flow, rule_alert, ml_result)
        if alert:
            store.alerts[alert["alert_id"]] = alert
            fused_alerts.append(alert)

        if progress_cb and i % 10 == 0:
            progress_cb("detecting", i + 1, total)

    result.flow_count = len(valid_flows)
    result.alert_count = len(fused_alerts)
    result.stage_timings["detection"] = round(time.monotonic() - t1, 4)

    if progress_cb:
        progress_cb("graph_building", total, total)

    # ------------------------------------------------------------------ #
    # Stage 2: Build the entity graph                                     #
    # ------------------------------------------------------------------ #
    t2 = time.monotonic()
    # Graph is computed on-demand by backend/app/services/graph.py — no
    # pre-computation needed here since build_graph() reads from store.flows.
    result.stage_timings["graph"] = round(time.monotonic() - t2, 4)

    # ------------------------------------------------------------------ #
    # Stage 3: Compute summary                                            #
    # ------------------------------------------------------------------ #
    t3 = time.monotonic()
    result.summary = _compute_summary()
    result.stage_timings["summary"] = round(time.monotonic() - t3, 4)

    if progress_cb:
        progress_cb("complete", total, total)

    logger.info(
        "Pipeline complete: %d flows, %d alerts in %.3fs",
        result.flow_count,
        result.alert_count,
        result.elapsed_seconds,
    )
    return result


def run_pcap_pipeline(
    pcap_path: str,
    progress_cb: Callable[[str, int, int], None] | None = None,
) -> PipelineResult:
    """Parse a PCAP file and run the full pipeline on extracted flows."""
    result = PipelineResult()
    if progress_cb:
        progress_cb("parsing_pcap", 0, 1)

    t0 = time.monotonic()
    try:
        flows = _adapter.analyze_pcap(pcap_path)
    except Exception as exc:
        result.errors.append(f"PCAP parse failed: {exc}")
        return result

    result.stage_timings["pcap_parse"] = round(time.monotonic() - t0, 4)
    logger.info("PCAP parsed: %d flows from %s", len(flows), pcap_path)

    if not flows:
        result.errors.append("No IPv4 TCP/UDP/ICMP flows found in capture")
        return result

    sub = run_pipeline(flows, progress_cb=progress_cb)
    result.flow_count = sub.flow_count
    result.alert_count = sub.alert_count
    result.stage_timings.update(sub.stage_timings)
    result.errors.extend(sub.errors)
    result.summary = sub.summary
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fuse(flow: dict, alert: dict | None, ml: dict) -> dict | None:
    """Merge rule alert and ML verdict into one fused alert."""
    ml_fired = ml["threat_category"] != "BENIGN"

    if alert is None:
        if not ml_fired:
            return None
        alert = {
            "flow_id": flow["flow_id"],
            "rule_ids": ["ML_DETECTION"],
            "title": THREAT_LABELS.get(ml["threat_category"], ml["threat_category"]),
            "severity": ml["severity"],
            "risk_score": ml["risk_score"],
            "evidence": list(ml["evidence"]),
        }
    else:
        if int(ml["risk_score"]) >= int(alert["risk_score"]):
            alert["risk_score"] = int(ml["risk_score"])
            alert["severity"] = ml["severity"]
        alert["evidence"] = list(dict.fromkeys(alert["evidence"] + ml["evidence"]))
        if ml_fired:
            alert["rule_ids"] = list(dict.fromkeys(alert["rule_ids"] + ["ML_DETECTION"]))

    alert["alert_id"] = f"A-{flow['flow_id']}"
    alert["created_at"] = datetime.now(timezone.utc).isoformat()
    alert["ml"] = ml

    # Field aliases the ByteGuard frontend reads directly
    alert["id"] = alert["alert_id"]
    alert["entity"] = flow.get("source_ip", "unknown")
    alert["type"] = THREAT_LABELS.get(ml["threat_category"], "Suspicious Traffic")
    alert["risk"] = alert["risk_score"]
    alert["level"] = alert["severity"].title()
    alert["status"] = "Open"
    alert["time"] = _relative(flow.get("timestamp"))
    return alert


def _heuristic_ml_fallback(flow: dict) -> dict:
    """Minimal ML result when the real engine fails."""
    return {
        "threat_category": "BENIGN",
        "severity": "LOW",
        "risk_score": 0,
        "evidence": ["ml_engine_error"],
    }


def _relative(timestamp: str | None) -> str:
    if not timestamp:
        return "just now"
    try:
        then = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
    except ValueError:
        return "just now"
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)
    seconds = (datetime.now(timezone.utc) - then).total_seconds()
    for unit, size in (("d", 86400), ("h", 3600), ("m", 60)):
        if seconds >= size:
            return f"{int(seconds // size)}{unit} ago"
    return "just now"


def _compute_summary() -> dict[str, Any]:
    flows = list(store.flows.values())
    alerts = list(store.alerts.values())

    protocols: dict[str, int] = {}
    for flow in flows:
        app = flow.get("application", "UNKNOWN")
        protocols[app] = protocols.get(app, 0) + 1

    risks: dict[str, int] = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for alert in alerts:
        sev = alert.get("severity", "LOW")
        if sev in risks:
            risks[sev] += 1

    return {
        "total_flows": len(flows),
        "suspicious_flows": len(alerts),
        "high_risk": sum(1 for a in alerts if a.get("severity") in {"HIGH", "CRITICAL"}),
        "protocols": len(protocols),
        "risk_distribution": risks,
        "protocol_distribution": protocols,
        "recent_alerts": sorted(alerts, key=lambda a: a["created_at"], reverse=True)[:10],
    }


# ---------------------------------------------------------------------------
# Backward-compat shims (analysis.py still used by main.py imports)
# ---------------------------------------------------------------------------

def analyse_flows(flows: list[dict]) -> dict:
    """Drop-in replacement for the original analysis.py function."""
    result = run_pipeline(flows)
    return result.summary


analyse_fixture = analyse_flows


def summary() -> dict:
    return _compute_summary()
