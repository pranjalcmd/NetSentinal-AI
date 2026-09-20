"""SOC Agent with tool-calling loop.

The agent can call backend data-access tools to retrieve precise evidence
before formulating its final analyst answer. This avoids hallucination by
grounding responses in actual store data rather than relying solely on the
prompt context.

Tools available to the agent:
  - get_flow(flow_id)           → raw flow dict
  - search_alerts(query)        → filtered alerts
  - get_entity_info(ip)         → all flows from/to an IP
  - get_path(src, dst)          → pathfinder result
  - get_top_risks(n)            → top-N alerts by risk score

The agent runs a lightweight reasoning loop:
  1. Parses the question for entity/flow references
  2. Calls relevant tools to fetch exact data
  3. Builds an enriched context
  4. Calls the active AI provider with that context
  5. Returns the final structured response + tool call log
"""
from __future__ import annotations

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# IP address pattern
_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
# Flow ID pattern (F-XXXX)
_FLOW_RE = re.compile(r"\bF-\d+\b", re.IGNORECASE)


class SOCAgent:
    """Multi-step SOC analyst agent with tool-calling capabilities."""

    def __init__(self, factory) -> None:
        self._factory = factory

    # ------------------------------------------------------------------
    # Tool definitions
    # ------------------------------------------------------------------

    def _get_flow(self, flow_id: str, store) -> dict[str, Any] | None:
        return store.flows.get(flow_id)

    def _search_alerts(self, query: str, store) -> list[dict[str, Any]]:
        """Fuzzy search alerts by title, entity, type, or severity."""
        q = query.lower()
        return [
            a for a in store.alerts.values()
            if q in (a.get("title") or "").lower()
            or q in (a.get("entity") or "").lower()
            or q in (a.get("type") or "").lower()
            or q in (a.get("severity") or "").lower()
        ]

    def _get_entity_info(self, ip: str, store) -> dict[str, Any]:
        flows_as_src = [f for f in store.flows.values() if f.get("source_ip") == ip]
        flows_as_dst = [f for f in store.flows.values() if f.get("destination_ip") == ip]
        alerts = [a for a in store.alerts.values() if a.get("entity") == ip]
        return {
            "ip": ip,
            "flows_as_source": len(flows_as_src),
            "flows_as_destination": len(flows_as_dst),
            "alerts": len(alerts),
            "max_risk": max((a.get("risk_score", 0) for a in alerts), default=0),
            "threat_types": list({a.get("title", "?") for a in alerts}),
            "protocols": list({f.get("application", "?") for f in flows_as_src + flows_as_dst}),
        }

    def _get_top_risks(self, n: int, store) -> list[dict[str, Any]]:
        return sorted(
            store.alerts.values(),
            key=lambda a: a.get("risk_score", 0),
            reverse=True,
        )[:n]

    # ------------------------------------------------------------------
    # Reasoning loop
    # ------------------------------------------------------------------

    async def run(
        self,
        question: str,
        capture_summary: dict[str, Any],
        store,
    ) -> dict[str, Any]:
        """Run the agent reasoning loop and return the final answer."""
        tool_calls_made: list[str] = []
        enriched_context: dict[str, Any] = {}

        # Step 1: extract IPs and flow IDs from the question
        ips_mentioned = _IP_RE.findall(question)
        flows_mentioned = _FLOW_RE.findall(question)

        # Step 2: call tools for explicitly mentioned entities
        if flows_mentioned:
            for fid in flows_mentioned[:3]:
                flow = self._get_flow(fid.upper(), store)
                if flow:
                    enriched_context.setdefault("referenced_flows", []).append(flow)
                    tool_calls_made.append(f"get_flow({fid})")

        if ips_mentioned:
            for ip in ips_mentioned[:3]:
                info = self._get_entity_info(ip, store)
                enriched_context.setdefault("entity_info", []).append(info)
                tool_calls_made.append(f"get_entity_info({ip})")

        # Step 3: always fetch top-N risks for context
        top_alerts = self._get_top_risks(12, store)
        tool_calls_made.append("get_top_risks(12)")

        # Step 4: detect question intent and run additional tools
        q_lower = question.lower()
        if any(word in q_lower for word in ["botnet", "dns", "scan", "exfil", "brute", "dos"]):
            # Search for relevant alerts
            matched = self._search_alerts(q_lower.split()[0], store)
            if matched:
                enriched_context["matched_alerts"] = matched[:5]
                tool_calls_made.append(f"search_alerts('{q_lower.split()[0]}')")

        # Step 5: enrich capture summary with tool findings
        enriched_summary = {
            **capture_summary,
            **enriched_context,
        }

        # Step 6: call the AI provider with enriched context
        result = await self._factory.ask_question(question, enriched_summary, top_alerts)

        # Step 7: annotate result with tool call log
        result["tool_calls_made"] = tool_calls_made
        return result
