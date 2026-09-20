"""Google Gemini provider driver.

Uses the Gemini REST API via httpx. Supports gemini-2.0-flash (default)
and gemini-1.5-pro. Falls back gracefully on any failure.
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

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(BaseAIProvider):
    """Google Gemini via REST API."""

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.0-flash",
        base_url: str = _GEMINI_BASE,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str | None:
        return self._model

    async def health_check(self) -> bool:
        return bool(self._api_key)

    def _url(self) -> str:
        return (
            f"{self._base_url}/models/{self._model}:generateContent"
            f"?key={self._api_key}"
        )

    async def _call(self, system: str, user: str) -> str | None:
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 2000,
                "responseMimeType": "application/json",
            },
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(self._url(), json=body)
                resp.raise_for_status()
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text
        except Exception as exc:
            logger.warning("Gemini call failed: %r — falling back to mock", exc)
            return None

    async def explain_alert(self, alert: dict[str, Any], flow: dict[str, Any] | None) -> dict[str, Any] | None:
        text = await self._call(
            SYSTEM_SOC_ANALYST + "\n\nRespond with valid JSON matching this schema: "
            "{summary: string, recommendations: string[], caveats: string[], "
            "technical_findings: string[], investigation_steps: string[]}",
            build_explain_prompt(alert, flow),
        )
        return _parse_json(text)

    async def ask_question(
        self,
        question: str,
        capture_summary: dict[str, Any],
        alerts: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        text = await self._call(
            SYSTEM_SOC_ANALYST + "\n\nRespond with valid JSON matching this schema: "
            "{answer: string, evidence: string[], follow_up_questions: string[]}",
            build_ask_prompt(question, capture_summary, alerts),
        )
        return _parse_json(text)

    async def generate_report(
        self,
        capture_summary: dict[str, Any],
        top_alerts: list[dict[str, Any]],
        title: str,
    ) -> dict[str, Any] | None:
        text = await self._call(
            SYSTEM_REPORT_WRITER + "\n\nRespond with valid JSON matching this schema: "
            "{executive_summary: string, key_risk_factors: string[], "
            "incident_timeline: string[], remediation_steps: string[], "
            "overall_severity: string, confidence: number}",
            build_report_prompt(capture_summary, top_alerts, title),
        )
        return _parse_json(text)


def _parse_json(text: str | None) -> dict | None:
    if text is None:
        return None
    try:
        # Strip markdown code fences if present
        t = text.strip()
        if t.startswith("```"):
            lines = t.splitlines()
            t = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        return json.loads(t)
    except Exception as exc:
        logger.warning("Gemini JSON parse failed: %r", exc)
        return None
