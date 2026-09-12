"""AI analyst layer.

Mock by default (no network, no key, deterministic). Set AI_API_KEY and the
same code path talks to Claude instead — see README "Where to put the API key".

Severity, confidence and evidence stay locally computed even in live mode: the
detection engines own the verdict, the model only writes the narrative. That
keeps the API schema identical whichever provider is active.

Self-check (from netsentinel/): python -m backend.app.services.ai_service
"""
from __future__ import annotations

import json

from backend.app.core.config import settings

_EXPLAIN_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "recommendations": {"type": "array", "items": {"type": "string"}},
        "caveats": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "recommendations", "caveats"],
    "additionalProperties": False,
}

_ASK_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "evidence": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "evidence"],
    "additionalProperties": False,
}

_SYSTEM = (
    "You are a network security analyst assisting a SOC. You are given nDPI flow "
    "telemetry and the verdicts of a rule engine plus an ML classifier. Explain what "
    "the evidence supports, never assert compromise as fact, and never invent flows, "
    "IPs or indicators that are not in the supplied data. Be concise and specific."
)


class AIService:
    """One instance, reused. The Anthropic client is built on first live call."""

    def __init__(self) -> None:
        self._client = None
        self._client_failed = False

    @property
    def provider(self) -> str:
        """What the next call will actually use."""
        if settings.ai_api_key and not self._client_failed:
            return "claude"
        return "mock"

    def _anthropic(self):
        if self._client is None and not self._client_failed:
            try:
                import anthropic  # deferred: optional dependency
            except ImportError:
                self._client_failed = True
                return None
            kwargs = {"api_key": settings.ai_api_key}
            if settings.ai_api_url:
                kwargs["base_url"] = settings.ai_api_url
            self._client = anthropic.AsyncAnthropic(**kwargs)
        return self._client

    async def _json_call(self, prompt: str, schema: dict) -> dict | None:
        """One structured Claude call. Returns None so callers fall back to mock."""
        if not settings.ai_api_key:
            return None
        client = self._anthropic()
        if client is None:
            return None
        try:
            response = await client.messages.create(
                model=settings.ai_model,
                max_tokens=2000,
                system=_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
                output_config={"format": {"type": "json_schema", "schema": schema}},
            )
            text = next(b.text for b in response.content if b.type == "text")
            return json.loads(text)
        except Exception as exc:  # noqa: BLE001
            # ponytail: any failure degrades to the mock rather than 500-ing the
            # investigation tab. Add retry/backoff if this gets user traffic.
            print(f"[ai_service] live call failed, using mock: {exc!r}")
            return None

    # ------------------------------------------------------------------
    # /api/alerts/{id}/explain
    # ------------------------------------------------------------------

    async def explain(self, alert: dict, flow: dict | None) -> dict:
        local = {
            "provider": self.provider,
            "threat_category": alert["title"],
            "severity": alert["severity"],
            "confidence": min(0.95, 0.55 + alert["risk_score"] / 200),
            "observed_evidence": alert["evidence"],
        }

        narrative = await self._json_call(
            "Explain this alert to the analyst who will triage it.\n\n"
            f"ALERT:\n{json.dumps(_trim(alert), indent=2)}\n\n"
            f"FLOW:\n{json.dumps(_trim(flow or {}), indent=2)}\n\n"
            "Give a 2-4 sentence summary, 3 concrete next investigative steps, "
            "and the caveats an analyst should hold in mind.",
            _EXPLAIN_SCHEMA,
        )
        if narrative is None:
            narrative = _mock_explain()
            local["provider"] = "mock"

        return {**local, **narrative}

    # ------------------------------------------------------------------
    # /api/ai/ask  (ByteGuard "AI Investigation" tab)
    # ------------------------------------------------------------------

    async def ask(self, question: str, summary: dict, alerts: list[dict]) -> dict:
        top = sorted(alerts, key=lambda a: a.get("risk_score", 0), reverse=True)[:12]

        result = await self._json_call(
            f"ANALYST QUESTION: {question}\n\n"
            f"CAPTURE SUMMARY:\n{json.dumps(_capture_summary(summary), indent=2)}\n\n"
            f"TOP ALERTS:\n{json.dumps([_trim(a) for a in top], indent=2)}\n\n"
            "Answer the question from this data only. In `evidence`, quote the "
            "specific flows, IPs, rules or scores you relied on.",
            _ASK_SCHEMA,
        )
        if result is None:
            result = _mock_ask(question, summary, top)

        result["provider"] = self.provider if result.get("answer") else "mock"
        return result


# ----------------------------------------------------------------------
# Mock path — also the fallback whenever a live call fails
# ----------------------------------------------------------------------

def _mock_explain() -> dict:
    return {
        "summary": (
            "The observed flow contains multiple indicators that warrant investigation. "
            "This assessment is based on the supplied telemetry and should not be "
            "treated as proof of compromise."
        ),
        "recommendations": [
            "Inspect the originating endpoint.",
            "Review the destination/domain history in your approved telemetry.",
            "Correlate the alert with endpoint and authentication logs.",
        ],
        "caveats": [
            "Anomaly indicators can have benign explanations.",
            "AI is an analyst-assistance layer, not the sole detection authority.",
        ],
    }


def _mock_ask(question: str, summary: dict, top: list[dict]) -> dict:
    if not top:
        return {
            "answer": (
                f"No alerts are currently loaded, so there is nothing to correlate "
                f"against \"{question}\". Load a capture via /api/analyze/pcap or "
                f"/api/demo/load first."
            ),
            "evidence": [f"{summary.get('total_flows', 0)} flows in the store"],
        }

    worst = top[0]
    answer = (
        f"Across {summary.get('total_flows', 0)} analysed flows, "
        f"{summary.get('suspicious_flows', 0)} are flagged and "
        f"{summary.get('high_risk', 0)} are high or critical. The strongest signal is "
        f"{worst.get('title')} on flow {worst.get('flow_id')} from "
        f"{worst.get('entity')} (risk {worst.get('risk_score')}, "
        f"{worst.get('severity')}). Start there, then work down the alert table by "
        f"risk score."
    )
    evidence = [f"{a.get('flow_id')}: {a.get('title')} — risk {a.get('risk_score')}" for a in top[:5]]
    evidence += [str(e) for e in worst.get("evidence", [])[:3]]
    return {"answer": answer, "evidence": evidence}


def _trim(obj: dict) -> dict:
    """Drop the bulky nested blobs before they hit the prompt."""
    return {k: v for k, v in obj.items() if k not in {"ml", "ml_detection", "probabilities"}}


def _capture_summary(summary: dict) -> dict:
    return {k: v for k, v in summary.items() if k != "recent_alerts"}


ai_service = AIService()


if __name__ == "__main__":
    # Self-check: the mock path must satisfy the frontend's shape with no key set.
    import asyncio

    settings.ai_api_key = None
    svc = AIService()
    out = asyncio.run(svc.ask("what is happening?", {"total_flows": 0}, []))
    assert set(out) >= {"answer", "evidence"}, out
    assert isinstance(out["evidence"], list)

    alert = {"title": "DNS Tunneling", "severity": "HIGH", "risk_score": 70,
             "evidence": ["avg query length 61.2"], "flow_id": "F-0001"}
    out = asyncio.run(svc.explain(alert, {"source_ip": "10.0.0.5"}))
    assert set(out) >= {"summary", "recommendations", "caveats", "confidence"}, out
    assert svc.provider == "mock"
    print("ai_service self-check ok")
