"""AI layer public interface.

Import from here, not from the submodules directly.

Usage:
    from ai import get_factory, SOCAgent

    factory = get_factory()          # returns the singleton ProviderFactory
    agent   = SOCAgent(factory)      # SOC analyst agent with tool calling
"""
from ai.providers.factory import get_factory, ProviderFactory
from ai.agent import SOCAgent
from ai.schemas import (
    AlertExplainResponse,
    AIAskRequest,
    AIAskResponse,
    ReportRequest,
    ReportResponse,
    ProviderInfo,
    ProviderListResponse,
    ProviderSwitchRequest,
)

__all__ = [
    "get_factory",
    "ProviderFactory",
    "SOCAgent",
    "AlertExplainResponse",
    "AIAskRequest",
    "AIAskResponse",
    "ReportRequest",
    "ReportResponse",
    "ProviderInfo",
    "ProviderListResponse",
    "ProviderSwitchRequest",
]
