"""Provider factory and fallback chain manager.

Selects the configured AI provider and wraps every method call in a
try/fallback chain so the API layer always gets a valid response.

Provider selection order (first configured wins):
  1. Explicit AI_PROVIDER setting
  2. claude   — if AI_API_KEY looks like an Anthropic key (sk-ant-)
  3. openai   — if OPENAI_API_KEY is set
  4. gemini   — if GEMINI_API_KEY is set
  5. ollama   — if OLLAMA_BASE_URL or OLLAMA_MODEL is set
  6. mock     — always available, never fails
"""
from __future__ import annotations

import logging
from typing import Any

from ai.providers.base import BaseAIProvider
from ai.providers.mock import MockProvider

logger = logging.getLogger(__name__)

_REGISTRY: dict[str, type[BaseAIProvider]] = {}


def _register(name: str):
    def decorator(cls):
        _REGISTRY[name] = cls
        return cls
    return decorator


# Lazy imports so optional packages don't break startup
def _build_claude(settings) -> BaseAIProvider | None:
    if not settings.ai_api_key:
        return None
    from ai.providers.claude import ClaudeProvider
    return ClaudeProvider(
        api_key=settings.ai_api_key,
        model=settings.ai_model,
        base_url=settings.ai_api_url,
    )


def _build_openai(settings) -> BaseAIProvider | None:
    if not settings.openai_api_key:
        return None
    from ai.providers.openai import OpenAIProvider
    return OpenAIProvider(
        api_key=settings.openai_api_key,
        model=settings.openai_model,
    )


def _build_gemini(settings) -> BaseAIProvider | None:
    if not settings.gemini_api_key:
        return None
    from ai.providers.gemini import GeminiProvider
    return GeminiProvider(
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
    )


def _build_ollama(settings) -> BaseAIProvider | None:
    from ai.providers.ollama import OllamaProvider
    return OllamaProvider(
        base_url=settings.ollama_base_url,
        model=settings.ollama_model,
    )


_BUILDERS = {
    "claude": _build_claude,
    "openai": _build_openai,
    "gemini": _build_gemini,
    "ollama": _build_ollama,
}

_mock = MockProvider()


class ProviderFactory:
    """Holds the active provider and routes calls with mock fallback."""

    def __init__(self, settings) -> None:
        self._settings = settings
        self._active: BaseAIProvider = _mock
        self._active_name: str = "mock"
        self._initialize()

    def _initialize(self) -> None:
        explicit = (self._settings.ai_provider or "").lower().strip()

        # If explicitly set to mock, use mock immediately — no auto-detection.
        if explicit == "mock":
            logger.info("AI provider: mock (explicitly configured)")
            return

        # Try explicitly configured provider first
        if explicit:
            provider = self._try_build(explicit)
            if provider:
                self._active = provider
                self._active_name = explicit
                logger.info("AI provider: %s (%s)", explicit, provider.model_name)
                return

        # Auto-detect from key-guarded providers (NOT ollama — it has no key guard)
        for name in ("claude", "openai", "gemini"):
            provider = self._try_build(name)
            if provider:
                self._active = provider
                self._active_name = name
                logger.info("AI provider auto-detected: %s (%s)", name, provider.model_name)
                return

        logger.info("AI provider: mock (no keys configured)")

    def _try_build(self, name: str) -> BaseAIProvider | None:
        builder = _BUILDERS.get(name)
        if builder is None:
            return None
        try:
            p = builder(self._settings)
            return p
        except Exception as exc:
            logger.debug("Could not build %s provider: %r", name, exc)
            return None

    # ------------------------------------------------------------------
    # Public interface — mirrors BaseAIProvider but always returns a value
    # ------------------------------------------------------------------

    @property
    def provider_name(self) -> str:
        return self._active_name

    @property
    def active_provider(self) -> BaseAIProvider:
        return self._active

    def switch_provider(self, name: str) -> bool:
        """Attempt to switch to a named provider. Returns True on success."""
        name = name.lower().strip()
        if name == "mock":
            self._active = _mock
            self._active_name = "mock"
            return True
        p = self._try_build(name)
        if p is None:
            return False
        self._active = p
        self._active_name = name
        logger.info("Switched AI provider to: %s", name)
        return True

    def list_providers(self) -> list[dict[str, Any]]:
        """Return info about all providers and their availability."""
        from ai.providers.claude import ClaudeProvider
        from ai.providers.openai import OpenAIProvider
        from ai.providers.gemini import GeminiProvider
        from ai.providers.ollama import OllamaProvider

        result = []
        for name, builder in _BUILDERS.items():
            p = self._try_build(name)
            result.append({
                "name": name,
                "active": self._active_name == name,
                "healthy": p is not None,
                "model": p.model_name if p else None,
                "description": _DESCRIPTIONS.get(name, ""),
            })
        result.append({
            "name": "mock",
            "active": self._active_name == "mock",
            "healthy": True,
            "model": None,
            "description": "Offline deterministic mock analyst — always available",
        })
        return result

    async def explain_alert(
        self, alert: dict[str, Any], flow: dict[str, Any] | None
    ) -> dict[str, Any]:
        result = await self._active.explain_alert(alert, flow)
        if result is None:
            logger.warning("Provider %s returned None for explain_alert, using mock", self._active_name)
            result = await _mock.explain_alert(alert, flow)
        return result

    async def ask_question(
        self,
        question: str,
        capture_summary: dict[str, Any],
        alerts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        result = await self._active.ask_question(question, capture_summary, alerts)
        if result is None:
            logger.warning("Provider %s returned None for ask_question, using mock", self._active_name)
            result = await _mock.ask_question(question, capture_summary, alerts)
        return result

    async def generate_report(
        self,
        capture_summary: dict[str, Any],
        top_alerts: list[dict[str, Any]],
        title: str,
    ) -> dict[str, Any]:
        result = await self._active.generate_report(capture_summary, top_alerts, title)
        if result is None:
            logger.warning("Provider %s returned None for generate_report, using mock", self._active_name)
            result = await _mock.generate_report(capture_summary, top_alerts, title)
        return result


_DESCRIPTIONS = {
    "claude": "Anthropic Claude — requires AI_API_KEY=sk-ant-...",
    "openai": "OpenAI GPT-4o — requires OPENAI_API_KEY",
    "gemini": "Google Gemini — requires GEMINI_API_KEY",
    "ollama": "Local LLM via Ollama — requires Ollama running locally",
}


# Singleton — initialised once when the module is imported by ai_service.py
_factory_instance: ProviderFactory | None = None


def get_factory(settings=None) -> ProviderFactory:
    global _factory_instance
    if _factory_instance is None:
        if settings is None:
            from backend.app.core.config import settings as _s
            settings = _s
        _factory_instance = ProviderFactory(settings)
    return _factory_instance
