from dataclasses import dataclass
from typing import Any, Iterable
from detection.scoring import severity_for, clamp_score

DNS_FREQUENCY_THRESHOLD = 4.0
DNS_LONG_QUERY_THRESHOLD = 55.0
LEGACY_PORTS = {23, 2323}


@dataclass
class Finding:
    rule_id: str
    title: str
    weight: int
    evidence: str


def _to_float(value: Any, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int) -> int:
    return int(_to_float(value, default))


def _to_int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _safe_metadata(flow: dict) -> dict:
    metadata = flow.get("metadata")
    return metadata if isinstance(metadata, dict) else {}


def _safe_ndpi_risks(flow: dict) -> list:
    risks = flow.get("ndpi_risks")
    return risks if isinstance(risks, list) else []


def evaluate_flow(flow: dict) -> list[Finding]:
    out: list[Finding] = []
    app = (flow.get("application") or "").upper()
    packets = _to_int(flow.get("packets"), 0)
    duration = max(_to_float(flow.get("duration_seconds"), 1.0), 1.0)
    dport = _to_int_or_none(flow.get("destination_port"))
    metadata = _safe_metadata(flow)

    if app == "DNS":
        rate = packets / duration
        if rate > DNS_FREQUENCY_THRESHOLD:
            out.append(Finding(
                "DNS_HIGH_FREQUENCY", "High DNS request frequency", 25,
                f"Observed {rate:.1f} packets/sec on a DNS flow, above the configured "
                f"threshold of {DNS_FREQUENCY_THRESHOLD:.1f} packets/sec. This may indicate "
                "abnormal DNS usage; it does not by itself prove an attack."
            ))

        avg_query_length = _to_float(metadata.get("avg_query_length"), 0.0)
        if avg_query_length >= DNS_LONG_QUERY_THRESHOLD:
            out.append(Finding(
                "DNS_LONG_QUERY", "Unusually long DNS queries", 20,
                f"Average observed DNS query length is {avg_query_length:.0f} characters, "
                f"at or above the configured threshold of {DNS_LONG_QUERY_THRESHOLD:.0f} characters. "
                "This indicates unusual DNS query characteristics; it does not confirm DNS tunneling."
            ))

    if dport in LEGACY_PORTS:
        out.append(Finding(
            "UNUSUAL_LEGACY_PORT", "Legacy remote-access port observed", 15,
            f"Destination port {dport} is commonly associated with legacy remote-access services. "
            "This observation alone does not confirm malicious activity."
        ))

    if metadata.get("repeated_destination", False):
        out.append(Finding(
            "REPEATED_DESTINATION", "Repeated outbound connection pattern", 15,
            "The source repeatedly contacted the same external destination. "
            "This is a correlation indicator, not proof of malicious intent."
        ))

    if metadata.get("high_outbound_ratio", False):
        out.append(Finding(
            "HIGH_OUTBOUND_VOLUME", "Unusually high outbound volume", 15,
            "Outbound byte volume is high relative to the capture baseline. "
            "This may warrant investigation but can also reflect a legitimate large transfer."
        ))

    for risk in _safe_ndpi_risks(flow):
        out.append(Finding(
            "NDPI_RISK", "nDPI reported a flow risk", 25,
            f"nDPI risk indicator observed: {risk}. This is a DPI-level signal that should be "
            "investigated further; it does not by itself confirm compromise."
        ))

    return out


def build_alert(flow: dict, findings: Iterable[Finding]) -> dict | None:
    findings = list(findings)
    if not findings:
        return None

    unique: list[Finding] = []
    seen: set[tuple[str, str]] = set()
    for finding in findings:
        key = (finding.rule_id, finding.evidence)
        if key in seen:
            continue
        seen.add(key)
        unique.append(finding)

    score = clamp_score(sum(f.weight for f in unique))
    return {
        "flow_id": flow["flow_id"],
        "rule_ids": [f.rule_id for f in unique],
        "title": unique[0].title,
        "severity": severity_for(score),
        "risk_score": score,
        "evidence": [f.evidence for f in unique],
    }
