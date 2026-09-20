"""System prompts and context optimisers for all AI providers.

Context rules:
- Never send raw packet bytes or large payload arrays to the model.
- Keep prompt token budget under PROMPT_TOKEN_BUDGET (default 6 000 tokens).
- Structured JSON context is more reliable than free-text for evidence citation.
"""
from __future__ import annotations

import json
from typing import Any

# Rough character-to-token ratio (conservative).
_CHARS_PER_TOKEN = 4
PROMPT_TOKEN_BUDGET = 6_000
PROMPT_CHAR_BUDGET = PROMPT_TOKEN_BUDGET * _CHARS_PER_TOKEN

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

SYSTEM_SOC_ANALYST = (
    "You are a senior network security analyst assisting a SOC team. "
    "You are given structured nDPI flow telemetry and the verdicts of a "
    "transparent rule engine plus a supervised ML classifier. "
    "Your role is to explain what the evidence supports and suggest concrete "
    "investigation steps. "
    "Never assert compromise as proven fact. "
    "Never invent flows, IP addresses, or indicators that are not in the supplied data. "
    "Be concise, specific, and analyst-grade — avoid filler sentences. "
    "Always ground your answer in the evidence provided."
)

SYSTEM_REPORT_WRITER = (
    "You are a senior SOC analyst producing an executive incident report. "
    "Write clearly for both technical and non-technical audiences. "
    "Summarise risk, impact, and recommended remediation in structured sections. "
    "Do not include information that is not in the supplied telemetry."
)

# ---------------------------------------------------------------------------
# JSON output schemas (for providers that support structured output)
# ---------------------------------------------------------------------------

EXPLAIN_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "recommendations": {"type": "array", "items": {"type": "string"}},
        "caveats": {"type": "array", "items": {"type": "string"}},
        "technical_findings": {"type": "array", "items": {"type": "string"}},
        "investigation_steps": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "recommendations", "caveats"],
    "additionalProperties": False,
}

ASK_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "evidence": {"type": "array", "items": {"type": "string"}},
        "follow_up_questions": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "evidence"],
    "additionalProperties": False,
}

REPORT_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "executive_summary": {"type": "string"},
        "key_risk_factors": {"type": "array", "items": {"type": "string"}},
        "incident_timeline": {"type": "array", "items": {"type": "string"}},
        "remediation_steps": {"type": "array", "items": {"type": "string"}},
        "overall_severity": {"type": "string"},
        "confidence": {"type": "number"},
    },
    "required": [
        "executive_summary", "key_risk_factors",
        "incident_timeline", "remediation_steps",
        "overall_severity", "confidence",
    ],
    "additionalProperties": False,
}

# ---------------------------------------------------------------------------
# Context builders
# ---------------------------------------------------------------------------

def _drop_noisy_keys(obj: dict[str, Any]) -> dict[str, Any]:
    """Remove fields that carry no analyst value but consume many tokens."""
    noisy = {
        "ml", "ml_detection", "probabilities", "raw_payload",
        "packet_bytes", "hex_dump", "raw_packets",
    }
    return {k: v for k, v in obj.items() if k not in noisy}


def _truncate_str(s: str, max_chars: int = 300) -> str:
    if len(s) <= max_chars:
        return s
    return s[:max_chars] + "…"


def trim_alert(alert: dict[str, Any]) -> dict[str, Any]:
    """Return a token-efficient subset of an alert for prompt injection."""
    a = _drop_noisy_keys(alert)
    # Limit evidence list to 10 entries
    if isinstance(a.get("evidence"), list):
        a["evidence"] = a["evidence"][:10]
    return a


def trim_flow(flow: dict[str, Any]) -> dict[str, Any]:
    """Return a token-efficient subset of a flow."""
    if not flow:
        return {}
    f = _drop_noisy_keys(flow)
    # Keep metadata shallow — no nested arrays
    if isinstance(f.get("metadata"), dict):
        f["metadata"] = {
            k: v for k, v in f["metadata"].items()
            if not isinstance(v, (list, bytes)) and k not in {"raw"}
        }
    return f


def build_explain_prompt(alert: dict[str, Any], flow: dict[str, Any] | None) -> str:
    alert_json = json.dumps(trim_alert(alert), indent=2)
    flow_json = json.dumps(trim_flow(flow or {}), indent=2)

    prompt = (
        "Explain this alert to the analyst who will triage it.\n\n"
        f"ALERT:\n{alert_json}\n\n"
        f"FLOW:\n{flow_json}\n\n"
        "Provide:\n"
        "- summary: 2-4 sentences on what the evidence shows\n"
        "- recommendations: 3-5 concrete next investigative steps\n"
        "- technical_findings: key technical indicators in the data\n"
        "- investigation_steps: ordered list of actions for the analyst\n"
        "- caveats: important limitations the analyst must keep in mind\n"
        "Base every claim on the supplied data only."
    )

    # Hard trim if over budget
    if len(prompt) > PROMPT_CHAR_BUDGET:
        prompt = prompt[:PROMPT_CHAR_BUDGET]

    return prompt


def build_ask_prompt(
    question: str,
    capture_summary: dict[str, Any],
    top_alerts: list[dict[str, Any]],
) -> str:
    summary_json = json.dumps(
        {k: v for k, v in capture_summary.items() if k != "recent_alerts"},
        indent=2,
    )
    alerts_json = json.dumps([trim_alert(a) for a in top_alerts[:12]], indent=2)

    prompt = (
        f"ANALYST QUESTION: {question}\n\n"
        f"CAPTURE SUMMARY:\n{summary_json}\n\n"
        f"TOP ALERTS (by risk score):\n{alerts_json}\n\n"
        "Answer the question from this data only. "
        "In `evidence`, cite the specific flows, IPs, rules, or scores you relied on. "
        "In `follow_up_questions`, suggest 2-3 questions the analyst should investigate next."
    )

    if len(prompt) > PROMPT_CHAR_BUDGET:
        prompt = prompt[:PROMPT_CHAR_BUDGET]

    return prompt


def build_report_prompt(
    capture_summary: dict[str, Any],
    top_alerts: list[dict[str, Any]],
    title: str = "NetSentinel Incident Report",
) -> str:
    summary_json = json.dumps(
        {k: v for k, v in capture_summary.items() if k != "recent_alerts"},
        indent=2,
    )
    alerts_json = json.dumps([trim_alert(a) for a in top_alerts[:15]], indent=2)

    prompt = (
        f"Generate a SOC incident report titled: {title!r}\n\n"
        f"CAPTURE SUMMARY:\n{summary_json}\n\n"
        f"TOP ALERTS:\n{alerts_json}\n\n"
        "Write:\n"
        "- executive_summary: 3-5 sentence high-level overview for management\n"
        "- key_risk_factors: top risk indicators found\n"
        "- incident_timeline: chronological events inferred from the data\n"
        "- remediation_steps: prioritised actions to reduce risk\n"
        "- overall_severity: one of LOW / MEDIUM / HIGH / CRITICAL\n"
        "- confidence: 0.0-1.0 reflecting certainty given this telemetry\n"
        "Use only facts from the supplied data."
    )

    if len(prompt) > PROMPT_CHAR_BUDGET:
        prompt = prompt[:PROMPT_CHAR_BUDGET]

    return prompt
