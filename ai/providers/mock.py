"""Rich deterministic mock AI provider.

Produces context-aware, analyst-grade responses without any external API
calls. Used:
  - as the default when no AI_API_KEY is configured
  - as the fallback when any live provider fails

The mock reads the actual alert data and generates coherent analysis so the
demo feels genuine even without a live AI key.
"""
from __future__ import annotations

import random
from typing import Any

from ai.providers.base import BaseAIProvider


class MockProvider(BaseAIProvider):
    """Offline deterministic mock analyst."""

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str | None:
        return None

    async def health_check(self) -> bool:
        return True

    # ------------------------------------------------------------------
    async def explain_alert(
        self,
        alert: dict[str, Any],
        flow: dict[str, Any] | None,
    ) -> dict[str, Any]:
        title = alert.get("title", "Suspicious Traffic")
        severity = alert.get("severity", "MEDIUM")
        risk = alert.get("risk_score", 50)
        evidence = alert.get("evidence", [])
        entity = alert.get("entity", "unknown host")
        flow = flow or {}
        app = flow.get("application", "Unknown")
        dst = flow.get("destination_ip", "unknown destination")

        summary = (
            f"The flow from {entity} to {dst} ({app}) triggered a "
            f"{title} alert with a risk score of {risk} ({severity} severity). "
            f"The detection engine identified {len(evidence)} indicator(s) "
            "that warrant analyst review. "
            "This assessment is based on observed telemetry and should not be "
            "treated as confirmed compromise without corroborating evidence."
        )

        recommendations = _recommendations_for(title)
        technical_findings = [str(e) for e in evidence[:5]]
        investigation_steps = _investigation_steps_for(title, entity, dst)
        caveats = [
            "Anomaly indicators can have benign explanations (e.g. misconfigured software, backup jobs).",
            "Correlate this alert with endpoint and authentication logs before escalating.",
            "AI analysis is an assistance layer — the rule engine and ML classifier own the verdict.",
        ]

        return {
            "summary": summary,
            "recommendations": recommendations,
            "technical_findings": technical_findings,
            "investigation_steps": investigation_steps,
            "caveats": caveats,
        }

    # ------------------------------------------------------------------
    async def ask_question(
        self,
        question: str,
        capture_summary: dict[str, Any],
        alerts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        total = capture_summary.get("total_flows", 0)
        suspicious = capture_summary.get("suspicious_flows", 0)
        high_risk = capture_summary.get("high_risk", 0)

        if not alerts:
            return {
                "answer": (
                    f"No alerts are currently loaded, so there is nothing to "
                    f"correlate against '{question}'. "
                    "Load a capture via POST /api/analyze/pcap or POST /api/demo/load first."
                ),
                "evidence": [f"{total} flows in the store, 0 alerts"],
                "follow_up_questions": [
                    "Can you upload a .pcap file for analysis?",
                    "Would you like to load the demo traffic instead?",
                ],
            }

        top = sorted(alerts, key=lambda a: a.get("risk_score", 0), reverse=True)
        worst = top[0]

        answer = (
            f"Across {total} analysed flows, {suspicious} are flagged as suspicious "
            f"and {high_risk} are high or critical severity. "
            f"The strongest signal is '{worst.get('title')}' on flow "
            f"{worst.get('flow_id')} from {worst.get('entity')} "
            f"(risk score {worst.get('risk_score')}, {worst.get('severity')} severity). "
            "Start your investigation there, then work down the alert table by risk score. "
            f"This analysis is relevant to your question: '{question}'."
        )

        evidence = [
            f"{a.get('flow_id')}: {a.get('title')} — risk {a.get('risk_score')} ({a.get('severity')})"
            for a in top[:6]
        ]
        evidence += [str(e) for e in worst.get("evidence", [])[:3]]

        follow_up = [
            f"Which source IP is responsible for the highest risk flows?",
            f"Are there any lateral movement indicators between internal hosts?",
            f"What is the protocol distribution of the suspicious flows?",
        ]

        return {
            "answer": answer,
            "evidence": evidence,
            "follow_up_questions": follow_up,
        }

    # ------------------------------------------------------------------
    async def generate_report(
        self,
        capture_summary: dict[str, Any],
        top_alerts: list[dict[str, Any]],
        title: str,
    ) -> dict[str, Any]:
        total = capture_summary.get("total_flows", 0)
        suspicious = capture_summary.get("suspicious_flows", 0)
        high_risk = capture_summary.get("high_risk", 0)
        protocols = capture_summary.get("protocols", 0)
        risk_dist = capture_summary.get("risk_distribution", {})

        # Derive overall severity
        if risk_dist.get("CRITICAL", 0) > 0:
            overall_sev = "CRITICAL"
        elif risk_dist.get("HIGH", 0) > 0:
            overall_sev = "HIGH"
        elif risk_dist.get("MEDIUM", 0) > 0:
            overall_sev = "MEDIUM"
        else:
            overall_sev = "LOW"

        threat_types = list({a.get("title", "Unknown") for a in top_alerts[:10]})
        top_entities = list({a.get("entity", "?") for a in top_alerts[:5]})

        executive_summary = (
            f"NetSentinel analysed {total} network flows across {protocols} protocols. "
            f"{suspicious} flows ({round(suspicious/max(total,1)*100)}%) were flagged as suspicious, "
            f"with {high_risk} classified as HIGH or CRITICAL severity. "
            f"The primary threat categories identified are: {', '.join(threat_types[:4])}. "
            f"Entities of interest include: {', '.join(top_entities[:3])}. "
            "Immediate attention is recommended for the flows listed in the Top Threats section."
        )

        key_risks = [
            f"{risk_dist.get('CRITICAL',0)} CRITICAL severity alerts detected" if risk_dist.get('CRITICAL',0) else None,
            f"{risk_dist.get('HIGH',0)} HIGH severity alerts detected" if risk_dist.get('HIGH',0) else None,
            f"Threat types present: {', '.join(threat_types[:5])}",
            f"{round(suspicious/max(total,1)*100)}% of flows are flagged as suspicious",
            f"Top risk entity: {top_entities[0] if top_entities else 'unknown'}",
        ]
        key_risks = [r for r in key_risks if r]

        timeline = []
        for a in sorted(top_alerts[:8], key=lambda x: x.get("created_at", "")):
            timeline.append(
                f"[{a.get('time', 'unknown time')}] {a.get('title')} detected on "
                f"flow {a.get('flow_id')} from {a.get('entity')} (risk: {a.get('risk_score')})"
            )

        remediation = [
            "Immediately isolate hosts with CRITICAL severity alerts from the network.",
            "Review and block flagged external IP addresses at the firewall.",
            "Audit authentication logs for any brute-force attempts from flagged sources.",
            "Inspect DNS query logs for tunneling indicators (high entropy, long queries).",
            "Patch legacy services flagged by SUSPICIOUS_LEGACY_SERVICE rules.",
            "Enable enhanced logging on the top-risk source IPs for 72 hours.",
            "Escalate confirmed incidents to the incident response team.",
        ]

        confidence = min(0.95, 0.5 + suspicious / max(total, 1))

        return {
            "executive_summary": executive_summary,
            "key_risk_factors": key_risks,
            "incident_timeline": timeline or ["No timestamped events available."],
            "remediation_steps": remediation,
            "overall_severity": overall_sev,
            "confidence": round(confidence, 2),
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _recommendations_for(threat_type: str) -> list[str]:
    base = [
        "Inspect the originating endpoint for signs of malware or misconfiguration.",
        "Review the destination IP/domain in your threat intelligence platform.",
        "Correlate this alert with endpoint detection and authentication logs.",
    ]
    extras = {
        "DNS Tunneling": [
            "Capture and decode DNS query payloads from the flagged host.",
            "Block outbound DNS to all resolvers except your authorised ones.",
        ],
        "Port Scan": [
            "Check whether the scanning host is authorised to perform network discovery.",
            "Review firewall rules — scanning internal IPs may indicate lateral movement.",
        ],
        "Data Exfiltration": [
            "Immediately review outbound data volumes from the flagged host.",
            "Check for sensitive file access events on the originating endpoint.",
        ],
        "Botnet C2": [
            "Quarantine the endpoint immediately and capture a full memory image.",
            "Block the C2 destination IPs at the perimeter and DNS layer.",
        ],
        "Brute Force": [
            "Lock the targeted account and reset credentials if compromise is suspected.",
            "Enable account lockout policies and review authentication logs.",
        ],
        "Denial of Service": [
            "Activate rate limiting and traffic shaping on the affected segment.",
            "Notify the network operations team for traffic diversion.",
        ],
    }
    for key, extra in extras.items():
        if key.lower() in threat_type.lower():
            return base + extra
    return base


def _investigation_steps_for(
    threat_type: str, entity: str, dst: str
) -> list[str]:
    return [
        f"1. Identify the user or process running on {entity} at the time of the alert.",
        f"2. Check if {dst} is a known-good destination in your asset inventory.",
        f"3. Pull endpoint logs from {entity} for the alert timeframe.",
        f"4. Search SIEM for other alerts involving {entity} in the last 24 hours.",
        f"5. Determine whether the {threat_type} behaviour is recurring or one-off.",
    ]
