"""Abstract base class for all AI provider drivers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseAIProvider(ABC):
    """All provider implementations must satisfy this interface."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Short identifier, e.g. 'claude', 'openai', 'gemini', 'ollama', 'mock'."""

    @property
    @abstractmethod
    def model_name(self) -> str | None:
        """Active model string, or None if not applicable."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider can accept requests right now."""

    @abstractmethod
    async def explain_alert(
        self,
        alert: dict[str, Any],
        flow: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Return structured alert explanation dict.

        Must always return a valid dict with at least:
        summary, recommendations, caveats.
        """

    @abstractmethod
    async def ask_question(
        self,
        question: str,
        capture_summary: dict[str, Any],
        alerts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Return structured answer dict.

        Must always return a valid dict with at least:
        answer, evidence.
        """

    @abstractmethod
    async def generate_report(
        self,
        capture_summary: dict[str, Any],
        top_alerts: list[dict[str, Any]],
        title: str,
    ) -> dict[str, Any]:
        """Return structured SOC incident report dict."""
