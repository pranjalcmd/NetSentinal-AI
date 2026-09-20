"""AI analyst service — refactored to delegate to the ai/ module.

Preserves full backward compatibility:
  - ai_service.provider  → string name of active provider
  - ai_service.explain() → same return shape as before
  - ai_service.ask()     → same return shape as before

All new functionality (multi-provider, SOC agent, report generation) is
accessed via the ProviderFactory and SOCAgent in the ai/ package.
"""
from __future__ import annotations

from typing import Any

from backend.app.core.config import settings


class AIService:
    """Thin adapter: original API → new ai/ module."""

    def __init__(self) -> None:
        self._factory = None
        self._agent = None

    def _ensure_init(self) -> None:
        """Lazy initialisation so startup failures don't crash the server."""
        if self._factory is None:
            from ai.providers.factory import get_factory
            from ai.agent import SOCAgent
            self._factory = get_factory(settings)
            self._agent = SOCAgent(self._factory)

    # ------------------------------------------------------------------
    # Legacy interface (main.py calls these directly)
    # ------------------------------------------------------------------

    @property
    def provider(self) -> str:
        self._ensure_init()
        return self._factory.provider_name

    async def explain(self, alert: dict, flow: dict | None) -> dict:
        """Explain one alert. Returns the same schema as the original service."""
        self._ensure_init()

        narrative = await self._factory.explain_alert(alert, flow)
        narrative = narrative or {}

        return {
            "provider": self._factory.provider_name,
            "threat_category": alert.get("title", "Unknown"),
            "severity": alert.get("severity", "MEDIUM"),
            "confidence": min(0.95, 0.55 + alert.get("risk_score", 50) / 200),
            "observed_evidence": alert.get("evidence", []),
            "summary": narrative.get("summary", ""),
            "recommendations": narrative.get("recommendations", []),
            "caveats": narrative.get("caveats", []),
            "technical_findings": narrative.get("technical_findings", []),
            "investigation_steps": narrative.get("investigation_steps", []),
        }

    async def ask(self, question: str, capture_summary: dict, alerts: list[dict]) -> dict:
        """Answer a free-text SOC question. Uses the SOC Agent tool loop."""
        self._ensure_init()
        from backend.app.services.store import store as _store
        result = await self._agent.run(question, capture_summary, _store)
        result.setdefault("provider", self._factory.provider_name)
        return result

    # ------------------------------------------------------------------
    # New: report generation
    # ------------------------------------------------------------------

    async def generate_report(
        self,
        capture_summary: dict,
        alerts: list[dict],
        title: str = "NetSentinel Incident Report",
    ) -> dict:
        self._ensure_init()
        top = sorted(alerts, key=lambda a: a.get("risk_score", 0), reverse=True)[:15]
        result = await self._factory.generate_report(capture_summary, top, title)
        result["provider"] = self._factory.provider_name
        result["title"] = title
        return result

    # ------------------------------------------------------------------
    # Provider management
    # ------------------------------------------------------------------

    def switch_provider(self, name: str) -> bool:
        self._ensure_init()
        return self._factory.switch_provider(name)

    def list_providers(self) -> list[dict]:
        self._ensure_init()
        return self._factory.list_providers()


# Module-level singleton — consumed by main.py
ai_service = AIService()
