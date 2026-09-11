"""Entity/relationship views over the analysed flows.

The ByteGuard frontend speaks in entities and links, not flows, so this
projects the flow table onto a graph: every IP is a node, every flow an edge.
"""
from collections import defaultdict, deque

from backend.app.services.store import store

# RFC1918 / loopback prefixes — used only to label a node internal vs external.
_PRIVATE_PREFIXES = ("10.", "192.168.", "127.", "169.254.")


def _is_internal(ip: str) -> bool:
    if ip.startswith(_PRIVATE_PREFIXES):
        return True
    if ip.startswith("172."):
        try:
            return 16 <= int(ip.split(".")[1]) <= 31
        except (IndexError, ValueError):
            return False
    return False


def _risk_by_ip() -> dict[str, int]:
    """Highest alert score seen on any flow touching each IP."""
    risk: dict[str, int] = defaultdict(int)
    for alert in store.alerts.values():
        flow = store.flows.get(alert["flow_id"])
        if not flow:
            continue
        score = int(alert.get("risk_score", 0))
        for ip in (flow.get("source_ip"), flow.get("destination_ip")):
            if ip:
                risk[ip] = max(risk[ip], score)
    return risk


def build_graph() -> dict:
    risk = _risk_by_ip()
    flagged_flows = {a["flow_id"] for a in store.alerts.values()}

    nodes: dict[str, dict] = {}
    links: list[dict] = []

    for flow in store.flows.values():
        src, dst = flow.get("source_ip"), flow.get("destination_ip")
        for ip in (src, dst):
            if ip and ip not in nodes:
                nodes[ip] = {
                    "id": ip,
                    "name": ip,
                    "label": ip,
                    "type": "person" if _is_internal(ip) else "organization",
                    "kind": "internal" if _is_internal(ip) else "external",
                    "risk": risk.get(ip, 0),
                    "central": False,
                }
        if src and dst:
            links.append({
                "source": src,
                "target": dst,
                "suspicious": flow.get("flow_id") in flagged_flows,
                "application": flow.get("application", "UNKNOWN"),
                "flow_id": flow.get("flow_id"),
            })

    # Mark the riskiest node so the force graph has a focal point.
    if nodes:
        top = max(nodes.values(), key=lambda n: (n["risk"], _degree(n["id"], links)))
        top["central"] = True

    return {"nodes": list(nodes.values()), "links": links}


def _degree(node_id: str, links: list[dict]) -> int:
    return sum(1 for l in links if l["source"] == node_id or l["target"] == node_id)


def build_entities() -> list[dict]:
    graph = build_graph()
    links = graph["links"]
    return sorted(
        (
            {**node, "connections": _degree(node["id"], links)}
            for node in graph["nodes"]
        ),
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
    for link in graph["links"]:
        neighbours[link["source"]].append(link)
        neighbours[link["target"]].append(link)

    queue = deque([(src, [src], [])])
    seen = {src}
    while queue:
        current, path, edges = queue.popleft()
        for link in neighbours[current]:
            nxt = link["target"] if link["source"] == current else link["source"]
            if nxt in seen:
                continue
            if nxt == dst:
                full = path + [nxt]
                used = edges + [link]
                return {
                    "path": [_node_step(nodes[i]) for i in full],
                    "hops": len(full) - 1,
                    "suspicious": sum(1 for e in used if e["suspicious"]),
                    "edges": [
                        {"source": e["source"], "target": e["target"],
                         "application": e["application"], "suspicious": e["suspicious"]}
                        for e in used
                    ],
                }
            seen.add(nxt)
            queue.append((nxt, path + [nxt], edges + [link]))
    return None


def _node_step(node: dict) -> dict:
    return {"name": node["name"], "type": node["type"], "risk": node["risk"]}
