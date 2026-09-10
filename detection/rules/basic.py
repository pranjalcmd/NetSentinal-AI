from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable
from detection.scoring import severity_for, clamp_score

@dataclass
class Finding:
    rule_id: str
    title: str
    weight: int
    evidence: str

def evaluate_flow(flow: dict) -> list[Finding]:
    out: list[Finding] = []
    app = (flow.get("application") or "").upper()
    packets = int(flow.get("packets", 0))
    duration = max(float(flow.get("duration_seconds", 1)), 1.0)
    dport = flow.get("destination_port")

    if app == "DNS" and packets / duration > 4:
        out.append(Finding("DNS_HIGH_FREQUENCY", "High DNS request frequency", 25,
                           f"Observed {packets / duration:.1f} packets/sec on a DNS flow."))
    if app == "DNS" and flow.get("metadata", {}).get("avg_query_length", 0) >= 55:
        out.append(Finding("DNS_LONG_QUERY", "Unusually long DNS queries", 20,
                           "Average observed DNS query length is above the configured threshold."))
    if dport in {23, 2323}:
        out.append(Finding("UNUSUAL_LEGACY_PORT", "Legacy remote-access port observed", 15,
                           f"Destination port {dport} is commonly associated with legacy remote-access services."))
    if flow.get("metadata", {}).get("repeated_destination", False):
        out.append(Finding("REPEATED_DESTINATION", "Repeated outbound connection pattern", 15,
                           "The source repeatedly contacted the same external destination."))
    if flow.get("metadata", {}).get("high_outbound_ratio", False):
        out.append(Finding("HIGH_OUTBOUND_VOLUME", "Unusually high outbound volume", 15,
                           "Outbound byte volume is high relative to the capture baseline."))
    for risk in flow.get("ndpi_risks", []):
        out.append(Finding("NDPI_RISK", "nDPI reported a flow risk", 25, f"nDPI risk indicator: {risk}"))
    return out

def build_alert(flow: dict, findings: Iterable[Finding]) -> dict | None:
    findings = list(findings)
    if not findings:
        return None
    score = clamp_score(sum(f.weight for f in findings))
    return {
        "flow_id": flow["flow_id"],
        "rule_ids": [f.rule_id for f in findings],
        "title": findings[0].title,
        "severity": severity_for(score),
        "risk_score": score,
        "evidence": [f.evidence for f in findings],
    }
