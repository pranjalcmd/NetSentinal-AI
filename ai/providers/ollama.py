"""Ollama local LLM provider driver.

Connects to a locally running Ollama instance (default: http://localhost:11434).
Works with Llama3, Mistral, Qwen, Phi-3, and any other Ollama-compatible model.
Falls back gracefully when Ollama is not running.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ai.providers.base import BaseAIProvider
from ai.prompts import (
    SYSTEM_SOC_ANALYST,
    SYSTEM_REPORT_WRITER,
    build_explain_prompt,
    build_ask_prompt,
    build_report_prompt,
)

logger = logging.getLogger(__name__)


class OllamaProvider(BaseAIProvider):
    """Local LLM via Ollama REST API."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3",
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str | None:
        return self._model

    async def health_check(self) -> bool:
        """Check if Ollama is reachable and model is available."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                if resp.status_code != 200:
                    return False
                models = [m["name"].split(":")[0] for m in resp.json().get("models", [])]
                return any(self._model.split(":")[0] in m for m in models)
        except Exception:
            return False

    async def _call(self, system: str, user: str) -> dict | None:
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.2, "num_predict": 2000},
        }
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    f"{self._base_url}/api/chat", json=body
                )
                resp.raise_for_status()
                text = resp.json()["message"]["content"]
                return json.loads(text)
        except Exception as exc:
            logger.warning("Ollama call failed: %r — falling back to mock", exc)
            return None

    async def explain_alert(self, alert: dict[str, Any], flow: dict[str, Any] | None) -> dict[str, Any] | None:
        schema_hint = (
            "Respond ONLY with valid JSON: "
            "{\"summary\": \"...\", \"recommendations\": [...], \"caveats\": [...], "
            "\"technical_findings\": [...], \"investigation_steps\": [...]}"
        )
        return await self._call(
            SYSTEM_SOC_ANALYST + "\n\n" + schema_hint,
            build_explain_prompt(alert, flow),
        )

    async def ask_question(
        self,
        question: str,
        capture_summary: dict[str, Any],
        alerts: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        schema_hint = (
            "Respond ONLY with valid JSON: "
            "{\"answer\": \"...\", \"evidence\": [...], \"follow_up_questions\": [...]}"
        )
        return await self._call(
            SYSTEM_SOC_ANALYST + "\n\n" + schema_hint,
            build_ask_prompt(question, capture_summary, alerts),
        )

    async def generate_report(
        self,
        capture_summary: dict[str, Any],
        top_alerts: list[dict[str, Any]],
        title: str,
    ) -> dict[str, Any] | None:
        schema_hint = (
            "Respond ONLY with valid JSON: "
            "{\"executive_summary\": \"...\", \"key_risk_factors\": [...], "
            "\"incident_timeline\": [...], \"remediation_steps\": [...], "
            "\"overall_severity\": \"HIGH\", \"confidence\": 0.8}"
        )
        return await self._call(
            SYSTEM_REPORT_WRITER + "\n\n" + schema_hint,
            build_report_prompt(capture_summary, top_alerts, title),
        )
