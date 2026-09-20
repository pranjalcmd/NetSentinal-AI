"""OpenAI GPT-4o provider driver.

Uses httpx for the REST API directly to avoid adding the openai package as a
hard dependency. Falls back gracefully on any failure.
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

_OPENAI_BASE = "https://api.openai.com/v1"


class OpenAIProvider(BaseAIProvider):
    """OpenAI GPT-4o / GPT-4-turbo via REST."""

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o",
        base_url: str = _OPENAI_BASE,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str | None:
        return self._model

    async def health_check(self) -> bool:
        return bool(self._api_key)

    async def _call(self, system: str, user: str, schema: dict) -> dict | None:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "netsentinel_response",
                    "strict": True,
                    "schema": schema,
                },
            },
            "max_tokens": 2000,
            "temperature": 0.2,
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    json=body,
                )
                resp.raise_for_status()
                data = resp.json()
                text = data["choices"][0]["message"]["content"]
                return json.loads(text)
        except Exception as exc:
            logger.warning("OpenAI call failed: %r — falling back to mock", exc)
            return None

    async def explain_alert(self, alert: dict[str, Any], flow: dict[str, Any] | None) -> dict[str, Any] | None:
        return await self._call(
            SYSTEM_SOC_ANALYST,
            build_explain_prompt(alert, flow),
            _openai_schema(_EXPLAIN_SCHEMA_PROPS),
        )

    async def ask_question(
        self,
        question: str,
        capture_summary: dict[str, Any],
        alerts: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        return await self._call(
            SYSTEM_SOC_ANALYST,
            build_ask_prompt(question, capture_summary, alerts),
            _openai_schema(_ASK_SCHEMA_PROPS),
        )

    async def generate_report(
        self,
        capture_summary: dict[str, Any],
        top_alerts: list[dict[str, Any]],
        title: str,
    ) -> dict[str, Any] | None:
        return await self._call(
            SYSTEM_REPORT_WRITER,
            build_report_prompt(capture_summary, top_alerts, title),
            _openai_schema(_REPORT_SCHEMA_PROPS),
        )


# ---------------------------------------------------------------------------
# Strict mode schemas for OpenAI (all properties must have additionalProperties:false
# and no optional fields — we make everything required)
# ---------------------------------------------------------------------------

def _openai_schema(properties: dict) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties.keys()),
        "additionalProperties": False,
    }


_EXPLAIN_SCHEMA_PROPS = {
    "summary": {"type": "string"},
    "recommendations": {"type": "array", "items": {"type": "string"}},
    "caveats": {"type": "array", "items": {"type": "string"}},
    "technical_findings": {"type": "array", "items": {"type": "string"}},
    "investigation_steps": {"type": "array", "items": {"type": "string"}},
}

_ASK_SCHEMA_PROPS = {
    "answer": {"type": "string"},
    "evidence": {"type": "array", "items": {"type": "string"}},
    "follow_up_questions": {"type": "array", "items": {"type": "string"}},
}

_REPORT_SCHEMA_PROPS = {
    "executive_summary": {"type": "string"},
    "key_risk_factors": {"type": "array", "items": {"type": "string"}},
    "incident_timeline": {"type": "array", "items": {"type": "string"}},
    "remediation_steps": {"type": "array", "items": {"type": "string"}},
    "overall_severity": {"type": "string"},
    "confidence": {"type": "number"},
}
