"""AI layer — wire protocol and the deterministic safety layer.

Two halves, both offline. No key, no network, no model latency, so this runs
in the normal suite.

The first half is the protocol contract. A previous version sent Gemini's URL
an Anthropic-shaped request and then tried to read an SSE stream out of a plain
JSON body, which fails in the least diagnosable way possible: HTTP 200, valid
JSON, zero usable events. So these pin the URL, the auth header, the field
names, and — the part that actually catches the bug — that a Gemini response is
parsed by `_gemini_text` and never routed near a stream parser.

The second half is `_scrub`/`_safe_steps`. The PRD forbids certainty claims and
remediation actions; the model produces both when left to itself ("strongly
indicates", "Isolate the source host"). A prompt is a request, a filter is a
guarantee, so the guarantee is what is tested.

Run: python -m pytest tests/test_ai_layer.py -q
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.app.core.config import settings
from backend.app.main import app
from backend.app.services import ai_service as M

REPO = Path(__file__).resolve().parents[1]


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload
        self.status_code = 200
        self.headers = {"content-type": "application/json; charset=UTF-8"}
        self.request = M.httpx.Request("POST", "https://example.invalid/v1beta/x")

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    """Stands in for httpx.AsyncClient; records exactly what was sent."""

    calls: list[dict] = []
    payload: dict = {}

    def __init__(self, *_, **__):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def post(self, url, headers=None, json=None):
        type(self).calls.append({"url": url, "headers": headers or {}, "body": json or {}})
        return _FakeResponse(type(self).payload)


@pytest.fixture
def gemini(monkeypatch):
    """Gemini selected, key present, HTTP intercepted. `gemini.calls[0]` is the request."""
    monkeypatch.setattr(settings, "ai_provider", "gemini")
    monkeypatch.setattr(settings, "ai_model", "gemini-3.6-flash")
    monkeypatch.setattr(settings, "ai_api_url", None)
    monkeypatch.setattr(settings, "ai_api_key", "test-key-not-real")
    _FakeClient.calls = []
    # ai_service imported httpx directly; patch it in its namespace, not the stdlib.
    with patch.object(M.httpx, "AsyncClient", _FakeClient):
        yield _FakeClient


def _explain(alert: dict | None = None, flow: dict | None = None) -> tuple[dict, M.AIService]:
    """Returns (response, the service that produced it) — so a test can read
    `last_error` off the instance that actually made the call."""
    alert = alert or {"title": "Possible DNS tunneling", "severity": "HIGH",
                      "risk_score": 78, "evidence": ["avg query length 61.2"],
                      "flow_id": "F-1", "rule_ids": ["DNS_LONG_QUERY"]}
    svc = M.AIService()
    return asyncio.run(svc.explain(alert, flow or {"flow_id": "F-1"})), svc


# ===========================================================================
# protocol — the request that goes out
# ===========================================================================

def test_gemini_goes_to_the_native_endpoint_with_the_gemini_key_header(gemini):
    """Not /v1/messages, not an Anthropic key header, not a Bearer token."""
    gemini.payload = {"candidates": [{"content": {"parts": [
        {"text": json.dumps({"summary": "s", "why_flagged": "w",
                             "recommendations": [], "caveats": []})}]}}]}
    _explain()

    call = gemini.calls[0]
    assert call["url"] == ("https://generativelanguage.googleapis.com/v1beta"
                           "/models/gemini-3.6-flash:generateContent"), call["url"]
    assert call["headers"] == {"x-goog-api-key": "test-key-not-real"}, call["headers"]
    assert "messages" not in call["body"], "Anthropic Messages body sent to Gemini"
    assert "system_instruction" in call["body"]
    assert call["body"]["generationConfig"]["responseMimeType"] == "application/json"
    # Streaming off. A stream here would need a second parser for no visible gain.
    assert "stream" not in call["url"] and "alt=sse" not in call["url"]
    assert call["body"].get("stream") is not True


def test_no_streaming_flag_anywhere_in_the_gemini_body(gemini):
    gemini.payload = {"candidates": [{"content": {"parts": [
        {"text": "{}"}]}}]}
    _explain()
    assert not any(k for k in gemini.calls[0]["body"] if "stream" in k.lower())


def test_a_gemini_200_body_is_parsed_as_json_not_run_through_a_stream_parser(gemini):
    """The original bug: plain JSON fed to an SSE reader yields 0 events."""
    answer = {"summary": "A burst of DNS queries.", "why_flagged": "Entropy above threshold.",
              "recommendations": ["Review DNS logs"], "caveats": ["Behavioural only."]}
    gemini.payload = {"candidates": [{"content": {"parts": [{"text": json.dumps(answer)}]},
                                      "finishReason": "STOP"}],
                      "usageMetadata": {"thoughtsTokenCount": 540, "candidatesTokenCount": 92}}
    out, svc = _explain()
    assert out["summary"] == "A burst of DNS queries."
    assert out["provider"] == "gemini"
    assert svc.last_error is None


@pytest.mark.parametrize("body,expect", [
    ({"candidates": [], "promptFeedback": {"blockReason": "SAFETY"}}, "no candidates"),
    ({"candidates": [{"finishReason": "MAX_TOKENS"}], "usageMetadata": {}}, "no text"),
    ({"candidates": [{"content": {"parts": [{"inlineData": "x"}]}}]}, "no text"),
])
def test_a_200_without_usable_content_raises_instead_of_returning_nothing(body, expect):
    with pytest.raises(RuntimeError) as exc:
        M._gemini_text(body)
    assert expect in str(exc.value), str(exc.value)


def test_the_three_providers_are_distinct_and_the_key_picks_the_adapter(monkeypatch):
    monkeypatch.setattr(settings, "ai_api_key", "k")
    for provider, model, expected in [("gemini", "gemini-3.6-flash", "gemini"),
                                      ("anthropic", "claude-opus-5", "anthropic"),
                                      ("openai", "gpt-x", "openai")]:
        monkeypatch.setattr(settings, "ai_provider", provider)
        monkeypatch.setattr(settings, "ai_model", model)
        assert M.AIService().provider == expected
    # A pasted key with AI_PROVIDER left at its default infers from the model name.
    monkeypatch.setattr(settings, "ai_provider", "mock")
    monkeypatch.setattr(settings, "ai_model", "gemini-3.6-flash")
    assert M.AIService().provider == "gemini"
    monkeypatch.setattr(settings, "ai_api_key", None)
    assert M.AIService().provider == "mock"


def test_a_provider_error_is_reported_with_status_and_host_and_redacts_the_key(monkeypatch):
    monkeypatch.setattr(settings, "ai_api_key", "SECRET-KEY-123")
    err = M.httpx.HTTPStatusError(
        "boom", request=M.httpx.Request("POST", "https://generativelanguage.googleapis.com/v1beta/x"),
        response=M.httpx.Response(404, headers={"content-type": "application/json"},
                                  text='{"error":{"message":"model not found SECRET-KEY-123"}}'))
    described = M._describe(err)
    assert "404" in described and "generativelanguage.googleapis.com" in described
    assert "model not found" in described, "the provider's own message must survive"
    assert "SECRET-KEY-123" not in described, "§47: never log the key"


def test_an_unknown_provider_falls_back_to_mock_rather_than_dispatching_wrong(monkeypatch):
    monkeypatch.setattr(settings, "ai_api_key", "k")
    monkeypatch.setattr(settings, "ai_provider", "banana")
    svc = M.AIService()
    assert asyncio.run(svc._json_call("x", {"type": "object"})) is None
    assert "banana" in (svc.last_error or "")


def test_a_provider_error_stays_one_line_and_says_when_it_was_cut(monkeypatch):
    """This string is `/api/health`'s `ai_last_error`, rendered as one field.

    Google pretty-prints its errors, so the raw body arrives as a ten-line JSON
    blob. A real 429 truncated at 400 chars used to end mid-number — reading as
    corrupted output rather than as a message that was cut.
    """
    monkeypatch.setattr(settings, "ai_api_key", None)
    body = json.dumps({"error": {"code": 429, "message": "quota " + "x" * 600}}, indent=2)
    described = M._describe(M.httpx.HTTPStatusError(
        "boom", request=M.httpx.Request("POST", "https://generativelanguage.googleapis.com/v1beta/x"),
        response=M.httpx.Response(429, headers={"content-type": "application/json"}, text=body)))

    assert "\n" not in described, "a multi-line error breaks the health field"
    assert "429" in described and "quota" in described
    assert "chars)" in described, f"a cut body must say it was cut: {described[-60:]}"


def test_a_short_error_body_is_passed_through_whole(monkeypatch):
    """The truncation marker must not show up on errors that fit."""
    monkeypatch.setattr(settings, "ai_api_key", None)
    described = M._describe(M.httpx.HTTPStatusError(
        "boom", request=M.httpx.Request("POST", "https://x.invalid/v1beta/y"),
        response=M.httpx.Response(404, headers={"content-type": "application/json"},
                                  text='{"error": "model gemini-9 not found"}')))
    assert "model gemini-9 not found" in described
    assert "chars)" not in described and "…" not in described


# ===========================================================================
# the deterministic layer — prompt forbids, code enforces
# ===========================================================================

def test_the_gemini_request_body_never_carries_secrets(gemini):
    """§46: minimized in code, so a caller passing secrets cannot leak them."""
    gemini.payload = {"candidates": [{"content": {"parts": [{"text": json.dumps(
        {"summary": "s", "why_flagged": "w", "recommendations": [], "caveats": []})}]}}]}
    _explain(
        alert={"title": "t", "severity": "HIGH", "risk_score": 70, "flow_id": "F-1",
               "rule_ids": ["R"], "evidence": ["e"],
               "authorization": "Bearer SUPERSECRET", "password": "hunter2"},
        flow={"flow_id": "F-1", "source_ip": "10.0.0.5", "packets": 10,
              "raw_payload": "session=SECRETSESS",
              "metadata": {"dns_query_entropy": 4.6, "session_cookie": "abc"}},
    )
    sent = json.dumps(gemini.calls[0]["body"])
    for secret in ("SUPERSECRET", "hunter2", "SECRETSESS", "abc"):
        assert secret not in sent, f"§46 leak: {secret}"
    # The permitted telemetry must still be there, or the analysis is blind.
    assert "10.0.0.5" in sent and "4.6" in sent


def test_minimize_keeps_only_allowlisted_keys():
    dirty = {"flow_id": "F-1", "source_ip": "10.0.0.5", "packets": 10,
             "password": "hunter2", "authorization": "Bearer abc",
             "raw_payload": "x", "cookie": "y", "session_token": "z"}
    assert M.minimize_flow(dirty) == {"flow_id": "F-1", "source_ip": "10.0.0.5", "packets": 10}


def test_certainty_language_is_rewritten_because_the_prompt_alone_does_not_hold():
    assert "confirmed" not in M._scrub("DNS tunneling confirmed.").lower()
    assert "definitely" not in M._scrub("This definitely shows exfiltration.").lower()
    assert "proves" not in M._scrub("The pattern proves compromise.").lower()


@pytest.mark.parametrize("step", [
    "Isolate the source host.",
    "Block the destination at the perimeter firewall.",
    "Quarantine the endpoint immediately.",
    "Shut down the affected server.",
])
def test_out_of_scope_remediation_is_dropped_not_reworded(step):
    """§66: this tool investigates. It does not block, isolate or remediate."""
    assert M._safe_steps([step, "Review the DNS logs for this host."]) == \
        ["Review the DNS logs for this host."]


def test_a_model_that_ignores_the_rules_still_cannot_get_them_into_the_response(gemini):
    """The whole point: enforce after the model, not by asking the model."""
    gemini.payload = {"candidates": [{"content": {"parts": [{"text": json.dumps({
        "summary": "DNS tunneling confirmed — the host is compromised.",
        "why_flagged": "Entropy.",
        "recommendations": ["Isolate the source host",
                            "Block the destination at the firewall",
                            "Review the DNS query log for this host"],
        "caveats": [],
    })}]}}]}
    out, _ = _explain()
    blob = json.dumps(out).lower()
    assert "confirmed" not in blob and "definitely" not in blob
    assert not any(w in blob for w in ("isolate", "block the", "quarantine"))
    assert out["recommendations"] == ["Review the DNS query log for this host"]


def test_the_verdict_is_local_so_the_model_cannot_restate_it(gemini):
    """§45: AI is not the sole detection authority. A model claiming CRITICAL
    cannot change the locally computed severity or risk score."""
    gemini.payload = {"candidates": [{"content": {"parts": [{"text": json.dumps({
        "summary": "s", "why_flagged": "w", "recommendations": [], "caveats": [],
        "severity": "CRITICAL", "risk_score": 99, "confidence": 0.99})}]}}]}
    out, _ = _explain({"title": "t", "severity": "MEDIUM", "risk_score": 44,
                    "confidence": 0.6, "flow_id": "F-1", "rule_ids": ["R"], "evidence": []})
    assert out["severity"] == "MEDIUM" and out["risk_score"] == 44


# ===========================================================================
# the endpoints the frontend calls
# ===========================================================================

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_reports_the_provider_and_never_the_key(client):
    body = client.get("/api/health").json()
    assert body["ai_provider"] in {"mock", "gemini", "anthropic", "openai"}
    assert "ai_key_configured" in body
    assert "test-key" not in json.dumps(body) and "AQ." not in json.dumps(body)


def test_explain_endpoint_returns_the_prd45_user_facing_shape(client):
    alerts = client.get("/api/alerts").json()
    if not alerts:
        pytest.skip("no alerts in the preloaded demo capture")

    result = client.post(f"/api/alerts/{alerts[0]['alert_id']}/explain").json()
    # Every provider is normalized into this, so the frontend never reads
    # provider-specific text (§45). Mock included — that is the point of it.
    for field in ("threat_category", "severity", "confidence", "summary",
                  "recommendations", "caveats", "observed_evidence", "provider"):
        assert field in result, (field, sorted(result))
    assert result["summary"] and result["severity"] == alerts[0]["severity"]

    # Reporting the mock honestly is what makes a misconfigured key visible.
    assert result["provider"] == ("mock" if not settings.ai_api_key else result["provider"])


def test_ask_endpoint_answers_and_cites_evidence(client):
    result = client.post("/api/ai/ask", json={"question": "what is happening?"}).json()
    assert result["answer"]
    assert isinstance(result["evidence"], list)
    assert result["provider"] in {"mock", "gemini", "anthropic", "openai"}


def test_ask_endpoint_requires_a_question(client):
    assert client.post("/api/ai/ask", json={"question": "   "}).status_code == 400


def test_the_ai_key_is_only_read_from_env_and_never_committed():
    """§47: never commit AI_API_KEY. .env is the only place it may live."""
    ignore = (REPO / ".gitignore").read_text(encoding="utf-8")
    assert ".env" in ignore, ".env must be gitignored"

    env_example = (REPO / ".env.example").read_text(encoding="utf-8")
    # .env.example is committed, so it must not carry a real key.
    for line in env_example.splitlines():
        if line.startswith("AI_API_KEY"):
            assert line.split("=", 1)[1].strip() == "", line

    for source in (REPO / "backend" / "app").rglob("*.py"):
        text = source.read_text(encoding="utf-8", errors="ignore")
        assert "AIza" not in text and "AQ.Ab8RN6" not in text, \
            f"hardcoded key in {source}"


# ===========================================================================
# /api/ai/report — the capture-level briefing (PRD §16 / §45 / §46)
# ===========================================================================

def test_report_endpoint_returns_the_briefing_shape(client):
    """The frontend renders these keys directly, so they are the contract."""
    report = client.post("/api/ai/report").json()
    assert {"executive_summary", "key_observations", "priorities",
            "caveats", "provider", "data_notice"} <= set(report)
    assert report["executive_summary"]
    assert isinstance(report["key_observations"], list)
    assert report["caveats"], "a briefing with no caveats overstates its evidence"
    assert report["provider"] in {"mock", "gemini", "anthropic", "openai"}


def test_report_priorities_are_targets_with_a_reason_and_a_next_step(client):
    """§45: every priority has to say what, why, and what would settle it."""
    for priority in client.post("/api/ai/report").json()["priorities"]:
        assert {"target", "why", "next_step"} <= set(priority)
        assert not M._OUT_OF_SCOPE.search(priority["next_step"]), priority


def test_report_carries_the_section_46_disclosure_verbatim(client):
    """The AI Investigation page must state what was sent. Exact wording."""
    assert client.post("/api/ai/report").json()["data_notice"] == (
        "Only normalized telemetry selected by the analysis pipeline is sent "
        "for AI enrichment. Raw packet payloads are not sent by default.")


def test_report_drops_remediation_advice_from_a_model_that_ignores_the_rules(gemini):
    """A prompt is a request; this is the guarantee. Same filter as explain().

    Intercepted at HTTP rather than by stubbing `_json_call`, so the parse and
    both filters are the real ones — stubbing the method under test would pass
    even if the wire path were broken.
    """
    gemini.payload = {"candidates": [{"content": {"parts": [{"text": json.dumps({
        "executive_summary": "This confirms the host is compromised.",
        "key_observations": ["Beaconing proves C2 activity."],
        "priorities": [
            {"target": "10.0.0.5", "why": "definitely malicious",
             "next_step": "Isolate the host and block the destination."},
            {"target": "10.0.0.9", "why": "scanning",
             "next_step": "Review the flow table for this host."},
        ],
        "caveats": [],
    })}]}}]}
    report = asyncio.run(M.AIService().report({"total_flows": 3}, [], []))

    blob = json.dumps(report)
    assert report["provider"] == "gemini", "precondition: the live path was taken"
    assert "confirms" not in blob and "proves" not in blob, blob
    assert "is compromised" not in blob, blob
    # The isolate/block step is dropped entirely, not reworded.
    assert [p["target"] for p in report["priorities"]] == ["10.0.0.9"], report["priorities"]
    assert report["caveats"], "an empty caveat list must fall back to the defaults"


def test_report_needs_an_analysed_capture_first(client):
    """Better a 409 than a briefing written about nothing."""
    from backend.app.services.store import store

    saved = dict(store.flows)
    store.flows.clear()
    try:
        assert client.post("/api/ai/report").status_code == 409
    finally:
        store.flows.update(saved)


def test_report_priority_targets_are_hosts_not_incident_ids(client):
    """A briefing that says `INC-f2fa2267…` where a host belongs is useless.

    This pins `_minimize_incident` against the keys the correlation engine
    really emits (`primary_host`, `title`, `narrative`). A renamed key there
    would otherwise degrade this silently: the schema still validates, the
    endpoint still 200s, and the analyst just gets opaque ids.
    """
    incidents = client.get("/api/incidents").json()
    if not incidents:
        pytest.skip("preloaded traffic raised no incidents")

    small = M._minimize_incident(incidents[0])
    assert small.get("primary_host"), f"no host survived minimization: {small}"
    assert small.get("title"), "the incident's own headline did not survive"
    # §46: engagement/customer identifiers are not analysis telemetry.
    assert not {"customer_id", "engagement_id", "sensor_ids"} & set(small), small

    targets = [p["target"] for p in client.post("/api/ai/report").json()["priorities"]]
    assert targets, "the briefing listed no priorities at all"
    assert not all(t.startswith("INC-") for t in targets), targets
