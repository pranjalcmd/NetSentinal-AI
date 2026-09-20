"""Entity/relationship views over the analysed flows.

The frontend speaks in entities and links, not flows, so this projects the flow
table onto a graph. It is a *projection*: nodes and edges are derived from
store.flows on every call and never kept as a second editable dataset (PRD §6).

One edge is one (source, destination, application) triple, carrying the ids of
every flow aggregated into it. Aggregating per flow instead would emit a
parallel edge per connection and make byte totals meaningless on a busy host.
"""
from collections import defaultdict, deque

from detection.context import is_internal
from detection.scoring import SEVERITY_ORDER

from backend.app.services.store import store


def build_graph() -> dict:
    """Nodes and aggregated edges for the current working set.

    Invariants the callers and tests rely on (PRD §6): every edge endpoint
    exists in `nodes`, every edge carries at least one real `flow_id`, and an
    edge's bytes/packets equal the sum over the flows it names.
    """
    alerts = {a["flow_id"]: a for a in store.alerts.values()}

    nodes: dict[str, dict] = {}
    edges: dict[tuple, dict] = {}
    inbound: dict[str, int] = defaultdict(int)
    outbound: dict[str, int] = defaultdict(int)

    for flow in store.flows.values():
        src, dst = flow.get("source_ip"), flow.get("destination_ip")
        if not src or not dst:
            continue    # half a flow cannot be an edge; PRD §6 forbids inventing the other end

        alert = alerts.get(flow.get("flow_id"))
        risk = int(alert.get("risk_score", 0)) if alert else 0
        severity = alert.get("severity") if alert else None

        for ip in ((src,) if src == dst else (src, dst)):
            node = nodes.get(ip)
            if node is None:
                node = nodes[ip] = {
                    "id": ip,
                    "name": ip,
                    "label": ip,
                    "type": "person" if is_internal(ip) else "organization",
                    "kind": "internal" if is_internal(ip) else "external",
                    "risk": 0,
                    "flow_count": 0,
                    "central": False,
                }
            node["risk"] = max(node["risk"], risk)
            node["flow_count"] += 1

        outbound[src] += 1
        inbound[dst] += 1

        application = flow.get("application") or "UNKNOWN"
        edge = edges.get((src, dst, application))
        if edge is None:
            edge = edges[(src, dst, application)] = {
                "id": f"{src}>{dst}>{application}",
                "source": src,
                "target": dst,
                "application": application,
                "flow_ids": [],
                "bytes": 0,
                "packets": 0,
                "risk": 0,
                "severity": None,
                "suspicious": False,
            }
        edge["flow_ids"].append(flow["flow_id"])
        edge["bytes"] += int(flow.get("bytes") or 0)
        edge["packets"] += int(flow.get("packets") or 0)
        edge["risk"] = max(edge["risk"], risk)
        if SEVERITY_ORDER.get(severity, -1) > SEVERITY_ORDER.get(edge["severity"], -1):
            edge["severity"] = severity
        edge["suspicious"] = edge["suspicious"] or alert is not None

    edge_list = list(edges.values())

    # An internal address that only ever receives traffic is a service, not an
    # operator's host — the one distinction the dashboard layout needs.
    for node in nodes.values():
        if node["kind"] == "internal" and inbound[node["id"]] and not outbound[node["id"]]:
            node["kind"] = "service"

    # Mark the riskiest node so the force graph has a focal point.
    if nodes:
        degree = _degrees(edge_list)
        top = max(nodes.values(), key=lambda n: (n["risk"], degree[n["id"]]))
        top["central"] = True

    return {"nodes": list(nodes.values()), "edges": edge_list}


def _degrees(edges: list[dict]) -> dict[str, int]:
    degree: dict[str, int] = defaultdict(int)
    for edge in edges:
        degree[edge["source"]] += 1
        degree[edge["target"]] += 1
    return degree


def build_entities() -> list[dict]:
    graph = build_graph()
    degree = _degrees(graph["edges"])
    return sorted(
        ({**node, "connections": degree[node["id"]]} for node in graph["nodes"]),
        key=lambda n: (n["risk"], n["connections"]),
        reverse=True,
    )


def shortest_path(src: str, dst: str) -> dict | None:
    """BFS over the flow graph. Returns None when either end is unknown."""
    graph = build_graph()
    nodes = {n["id"]: n for n in graph["nodes"]}
    # Accept either the node id or its display name.
    by_name = {n["name"]: n["id"] for n in graph["nodes"]}
    src = nodes.get(src, {}).get("id") or by_name.get(src)
    dst = nodes.get(dst, {}).get("id") or by_name.get(dst)
    if not src or not dst:
        return None
    if src == dst:
        return {"path": [_node_step(nodes[src])], "hops": 0, "suspicious": 0}

    neighbours: dict[str, list[dict]] = defaultdict(list)
    for edge in graph["edges"]:
        neighbours[edge["source"]].append(edge)
        neighbours[edge["target"]].append(edge)

    queue = deque([(src, [src], [])])
    seen = {src}
    while queue:
        current, path, used = queue.popleft()
        for edge in neighbours[current]:
            nxt = edge["target"] if edge["source"] == current else edge["source"]
            if nxt in seen:
                continue
            if nxt == dst:
                full = path + [nxt]
                walked = used + [edge]
                return {
                    "path": [_node_step(nodes[i]) for i in full],
                    "hops": len(full) - 1,
                    "suspicious": sum(1 for e in walked if e["suspicious"]),
                    "edges": [
                        {"source": e["source"], "target": e["target"],
                         "application": e["application"], "suspicious": e["suspicious"]}
                        for e in walked
                    ],
                }
            seen.add(nxt)
            queue.append((nxt, path + [nxt], used + [edge]))
    return None


def _node_step(node: dict) -> dict:
    return {"name": node["name"], "type": node["type"], "risk": node["risk"]}
