"""Anthropic Claude provider driver.

Uses structured JSON output via the claude-opus-5 (or configurable) model.
Falls back gracefully on any failure — never raises to the caller.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from ai.providers.base import BaseAIProvider
from ai.prompts import (
    SYSTEM_SOC_ANALYST,
    SYSTEM_REPORT_WRITER,
    EXPLAIN_JSON_SCHEMA,
    ASK_JSON_SCHEMA,
    REPORT_JSON_SCHEMA,
    build_explain_prompt,
    build_ask_prompt,
    build_report_prompt,
)

logger = logging.getLogger(__name__)


class ClaudeProvider(BaseAIProvider):
    """Anthropic Claude via the official Python SDK."""

    def __init__(self, api_key: str, model: str = "claude-opus-5", base_url: str | None = None) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = base_url
        self._client = None
        self._broken = False

    @property
    def provider_name(self) -> str:
        return "claude"

    @property
    def model_name(self) -> str | None:
        return self._model

    def _get_client(self):
        if self._client is None and not self._broken:
            try:
                import anthropic
                kwargs: dict[str, Any] = {"api_key": self._api_key}
                if self._base_url:
                    kwargs["base_url"] = self._base_url
                self._client = anthropic.AsyncAnthropic(**kwargs)
            except ImportError:
                logger.warning("anthropic package not installed — Claude unavailable")
                self._broken = True
        return self._client

    async def health_check(self) -> bool:
        return bool(self._api_key) and not self._broken

    async def _call(self, system: str, user: str, schema: dict) -> dict | None:
        if self._broken:
            return None
        client = self._get_client()
        if client is None:
            return None
        try:
            response = await client.messages.create(
                model=self._model,
                max_tokens=2000,
                system=system,
                messages=[{"role": "user", "content": user}],
                output_config={"format": {"type": "json_schema", "schema": schema}},
            )
            text = next(b.text for b in response.content if b.type == "text")
            return json.loads(text)
        except Exception as exc:
            logger.warning("Claude call failed: %r — falling back to mock", exc)
            return None

    async def explain_alert(self, alert: dict[str, Any], flow: dict[str, Any] | None) -> dict[str, Any] | None:
        return await self._call(
            SYSTEM_SOC_ANALYST,
            build_explain_prompt(alert, flow),
            EXPLAIN_JSON_SCHEMA,
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
            ASK_JSON_SCHEMA,
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
            REPORT_JSON_SCHEMA,
        )
