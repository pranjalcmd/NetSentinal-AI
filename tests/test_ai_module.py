"""Tests for the AI module: providers, factory, schemas, SOC agent."""
from __future__ import annotations

import asyncio
import pytest


# ---------------------------------------------------------------------------
# Mock provider
# ---------------------------------------------------------------------------

class TestMockProvider:
    def setup_method(self):
        from ai.providers.mock import MockProvider
        self.p = MockProvider()

    def test_provider_name(self):
        assert self.p.provider_name == "mock"

    def test_model_name_is_none(self):
        assert self.p.model_name is None

    def test_health_check(self):
        assert asyncio.run(self.p.health_check()) is True

    def test_explain_alert_schema(self):
        alert = {
            "title": "DNS Tunneling",
            "severity": "HIGH",
            "risk_score": 75,
            "evidence": ["avg query length 62.1", "entropy 3.8"],
            "entity": "10.0.0.5",
            "flow_id": "F-0001",
        }
        flow = {"source_ip": "10.0.0.5", "destination_ip": "8.8.8.8", "application": "DNS"}
        result = asyncio.run(self.p.explain_alert(alert, flow))
        assert "summary" in result
        assert "recommendations" in result
        assert isinstance(result["recommendations"], list)
        assert len(result["recommendations"]) >= 3
        assert "caveats" in result
        assert isinstance(result["caveats"], list)

    def test_explain_alert_no_flow(self):
        alert = {
            "title": "Port Scan",
            "severity": "MEDIUM",
            "risk_score": 55,
            "evidence": ["fan_out=250"],
            "entity": "10.0.0.2",
        }
        result = asyncio.run(self.p.explain_alert(alert, None))
        assert "summary" in result
        assert "10.0.0.2" in result["summary"] or "unknown" in result["summary"]

    def test_ask_with_alerts(self):
        alerts = [
            {"title": "Botnet C2", "risk_score": 90, "severity": "CRITICAL",
             "entity": "10.0.0.9", "flow_id": "F-002", "evidence": ["c2_beacon"]},
            {"title": "Port Scan", "risk_score": 60, "severity": "HIGH",
             "entity": "10.0.0.3", "flow_id": "F-003", "evidence": ["fan_out"]},
        ]
        summary = {"total_flows": 100, "suspicious_flows": 12, "high_risk": 3}
        result = asyncio.run(self.p.ask_question("What is the biggest threat?", summary, alerts))
        assert "answer" in result
        assert "evidence" in result
        assert isinstance(result["evidence"], list)
        assert "follow_up_questions" in result

    def test_ask_no_alerts(self):
        result = asyncio.run(self.p.ask_question("Anything suspicious?", {"total_flows": 0}, []))
        assert "answer" in result
        assert "No alerts" in result["answer"] or "nothing" in result["answer"].lower()

    def test_generate_report_schema(self):
        summary = {
            "total_flows": 500,
            "suspicious_flows": 45,
            "high_risk": 10,
            "protocols": 5,
            "risk_distribution": {"LOW": 5, "MEDIUM": 20, "HIGH": 15, "CRITICAL": 5},
        }
        alerts = [
            {"title": "Data Exfiltration", "risk_score": 88, "severity": "CRITICAL",
             "entity": "10.0.0.7", "flow_id": "F-010", "evidence": [],
             "created_at": "2026-09-13T10:00:00Z", "time": "2h ago"},
        ]
        result = asyncio.run(self.p.generate_report(summary, alerts, "Test Report"))
        assert "executive_summary" in result
        assert "key_risk_factors" in result
        assert "remediation_steps" in result
        assert "overall_severity" in result
        assert result["overall_severity"] in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0


# ---------------------------------------------------------------------------
# Prompt utilities
# ---------------------------------------------------------------------------

class TestPrompts:
    def test_trim_alert_removes_ml(self):
        from ai.prompts import trim_alert
        alert = {"title": "Port Scan", "ml": {"big": "data"}, "evidence": ["e1"]}
        trimmed = trim_alert(alert)
        assert "ml" not in trimmed
        assert "title" in trimmed

    def test_trim_flow_removes_raw_payload(self):
        from ai.prompts import trim_flow
        flow = {"source_ip": "1.2.3.4", "raw_payload": b"lots of bytes", "application": "HTTP"}
        trimmed = trim_flow(flow)
        assert "raw_payload" not in trimmed
        assert "source_ip" in trimmed

    def test_build_explain_prompt_returns_string(self):
        from ai.prompts import build_explain_prompt
        alert = {"title": "DNS Tunneling", "severity": "HIGH", "risk_score": 70, "evidence": []}
        p = build_explain_prompt(alert, None)
        assert isinstance(p, str)
        assert "DNS Tunneling" in p

    def test_build_ask_prompt_contains_question(self):
        from ai.prompts import build_ask_prompt
        p = build_ask_prompt("Is there a botnet?", {"total_flows": 50}, [])
        assert "botnet" in p.lower()

    def test_build_report_prompt_contains_title(self):
        from ai.prompts import build_report_prompt
        p = build_report_prompt({}, [], "My Report")
        assert "My Report" in p

    def test_prompt_under_budget(self):
        from ai.prompts import build_explain_prompt, PROMPT_CHAR_BUDGET
        alert = {"title": "X" * 10000, "severity": "HIGH", "risk_score": 99, "evidence": []}
        p = build_explain_prompt(alert, None)
        assert len(p) <= PROMPT_CHAR_BUDGET


# ---------------------------------------------------------------------------
# Provider factory
# ---------------------------------------------------------------------------

class TestProviderFactory:
    def test_factory_defaults_to_mock(self):
        from ai.providers.factory import ProviderFactory
        from backend.app.core.config import Settings
        s = Settings(ai_provider="mock")
        factory = ProviderFactory(s)
        assert factory.provider_name == "mock"

    def test_factory_lists_providers(self):
        from ai.providers.factory import ProviderFactory
        from backend.app.core.config import Settings
        factory = ProviderFactory(Settings(ai_provider="mock"))
        providers = factory.list_providers()
        names = [p["name"] for p in providers]
        assert "mock" in names
        assert "claude" in names
        assert "openai" in names
        assert "gemini" in names
        assert "ollama" in names

    def test_factory_mock_is_always_healthy(self):
        from ai.providers.factory import ProviderFactory
        from backend.app.core.config import Settings
        factory = ProviderFactory(Settings(ai_provider="mock"))
        providers = factory.list_providers()
        mock_info = next(p for p in providers if p["name"] == "mock")
        assert mock_info["healthy"] is True

    def test_factory_switch_to_mock(self):
        from ai.providers.factory import ProviderFactory
        from backend.app.core.config import Settings
        factory = ProviderFactory(Settings(ai_provider="mock"))
        ok = factory.switch_provider("mock")
        assert ok is True
        assert factory.provider_name == "mock"

    def test_factory_switch_to_unknown_fails(self):
        from ai.providers.factory import ProviderFactory
        from backend.app.core.config import Settings
        factory = ProviderFactory(Settings(ai_provider="mock"))
        ok = factory.switch_provider("some_nonexistent_provider")
        assert ok is False

    def test_factory_explain_falls_back_to_mock(self):
        """Even with no key the factory must return a valid explain result."""
        from ai.providers.factory import ProviderFactory
        from backend.app.core.config import Settings
        factory = ProviderFactory(Settings(ai_provider="mock"))
        alert = {"title": "Botnet", "severity": "HIGH", "risk_score": 80, "evidence": [], "entity": "x"}
        result = asyncio.run(factory.explain_alert(alert, None))
        assert "summary" in result
        assert "recommendations" in result

    def test_factory_ask_falls_back_to_mock(self):
        from ai.providers.factory import ProviderFactory
        from backend.app.core.config import Settings
        factory = ProviderFactory(Settings(ai_provider="mock"))
        result = asyncio.run(factory.ask_question("anything?", {"total_flows": 0}, []))
        assert "answer" in result


# ---------------------------------------------------------------------------
# SOC Agent
# ---------------------------------------------------------------------------

class _MockStore:
    flows = {
        "F-001": {"flow_id": "F-001", "source_ip": "10.0.0.5",
                   "destination_ip": "8.8.8.8", "application": "DNS"},
    }
    alerts = {
        "A-F-001": {"alert_id": "A-F-001", "flow_id": "F-001", "title": "DNS Tunneling",
                    "severity": "HIGH", "risk_score": 75, "entity": "10.0.0.5",
                    "evidence": ["avg_query_len=62"], "type": "DNS Tunneling",
                    "created_at": "2026-09-13T10:00:00Z"},
    }
    ai = {}
    jobs = {}


class TestSOCAgent:
    def setup_method(self):
        from ai.providers.factory import ProviderFactory
        from ai.agent import SOCAgent
        from backend.app.core.config import Settings
        factory = ProviderFactory(Settings(ai_provider="mock"))
        self.agent = SOCAgent(factory)

    def test_agent_returns_answer_and_evidence(self):
        result = asyncio.run(
            self.agent.run("What is the biggest threat?", {"total_flows": 1}, _MockStore())
        )
        assert "answer" in result
        assert "evidence" in result

    def test_agent_logs_tool_calls(self):
        result = asyncio.run(
            self.agent.run("Tell me about 10.0.0.5", {"total_flows": 1}, _MockStore())
        )
        assert "tool_calls_made" in result
        assert isinstance(result["tool_calls_made"], list)
        assert any("10.0.0.5" in tc for tc in result["tool_calls_made"])

    def test_agent_flow_lookup(self):
        result = asyncio.run(
            self.agent.run("Show me flow F-001", {"total_flows": 1}, _MockStore())
        )
        assert "tool_calls_made" in result
        assert any("F-001" in tc for tc in result["tool_calls_made"])

    def test_agent_no_alerts(self):
        class EmptyStore:
            flows = {}
            alerts = {}
            ai = {}
            jobs = {}

        result = asyncio.run(
            self.agent.run("Any threats?", {"total_flows": 0}, EmptyStore())
        )
        assert "answer" in result


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class TestSchemas:
    def test_alert_explain_response_valid(self):
        from ai.schemas import AlertExplainResponse
        r = AlertExplainResponse(
            provider="mock",
            threat_category="DNS Tunneling",
            severity="HIGH",
            confidence=0.85,
            observed_evidence=["avg_query_len=62"],
            summary="Test summary",
            recommendations=["Do X", "Do Y"],
            caveats=["May be benign"],
        )
        assert r.confidence == 0.85

    def test_ai_ask_response_valid(self):
        from ai.schemas import AIAskResponse
        r = AIAskResponse(
            provider="mock",
            answer="The biggest threat is Botnet C2",
            evidence=["F-002: risk 90"],
        )
        assert r.follow_up_questions == []

    def test_report_response_valid(self):
        from ai.schemas import ReportResponse
        r = ReportResponse(
            provider="mock",
            title="Test Report",
            executive_summary="Summary here",
            key_risk_factors=["High scan rate"],
            top_threats=[],
            incident_timeline=["Event 1"],
            remediation_steps=["Block IP"],
            overall_severity="HIGH",
            confidence=0.8,
        )
        assert r.overall_severity == "HIGH"
