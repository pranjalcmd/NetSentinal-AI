"""Graph projection + BFS pathfinding over the analysed flows."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.services.analysis import analyse_flows
from backend.app.services.graph import build_entities, build_graph, shortest_path
from backend.app.services.store import store

# A -> B -> C, plus an unrelated pair. B is the hub.
FLOWS = [
    {"flow_id": "F-1", "source_ip": "192.168.1.10", "destination_ip": "192.168.1.11",
     "source_port": 40000, "destination_port": 443, "transport": "TCP", "application": "HTTPS",
     "packets": 10, "bytes": 5000, "duration_seconds": 5, "ndpi_risks": [], "metadata": {}},
    {"flow_id": "F-2", "source_ip": "192.168.1.11", "destination_ip": "203.0.113.9",
     "source_port": 40001, "destination_port": 2323, "transport": "TCP", "application": "TELNET",
     "packets": 60, "bytes": 7000, "duration_seconds": 10, "ndpi_risks": ["Risky domain"],
     "metadata": {"repeated_destination": True}},
    {"flow_id": "F-3", "source_ip": "10.0.0.5", "destination_ip": "10.0.0.6",
     "source_port": 40002, "destination_port": 80, "transport": "TCP", "application": "HTTP",
     "packets": 4, "bytes": 900, "duration_seconds": 2, "ndpi_risks": [], "metadata": {}},
]


def setup_module(_module=None):
    analyse_flows([dict(f) for f in FLOWS])


def test_graph_shape():
    graph = build_graph()
    assert {n["id"] for n in graph["nodes"]} == {
        "192.168.1.10", "192.168.1.11", "203.0.113.9", "10.0.0.5", "10.0.0.6"
    }
    assert len(graph["edges"]) == 3
    # RFC1918 -> person (internal), public -> organization. TYPE_META needs both.
    types = {n["id"]: n["type"] for n in graph["nodes"]}
    assert types["192.168.1.10"] == "person"
    assert types["203.0.113.9"] == "organization"
    # The telnet + risky-domain flow must be the one flagged.
    assert [e["flow_ids"] for e in graph["edges"] if e["suspicious"]] == [["F-2"]]
    assert sum(1 for n in graph["nodes"] if n["central"]) == 1


def test_edges_reference_real_nodes_and_real_flows():
    """PRD §6 graph invariants — the contract the mesh renders against."""
    graph = build_graph()
    node_ids = {n["id"] for n in graph["nodes"]}

    for edge in graph["edges"]:
        assert edge["source"] in node_ids and edge["target"] in node_ids
        assert edge["flow_ids"], "an edge with no flow is an invented edge"
        assert all(fid in store.flows for fid in edge["flow_ids"])
        # Aggregated totals must equal the sum over the flows the edge names.
        referenced = [store.flows[fid] for fid in edge["flow_ids"]]
        assert edge["bytes"] == sum(f["bytes"] for f in referenced)
        assert edge["packets"] == sum(f["packets"] for f in referenced)


def test_edges_aggregate_flows_between_the_same_pair():
    """Two flows on one route collapse into one edge that sums them."""
    analyse_flows([
        {**FLOWS[0], "flow_id": "G-1", "packets": 3, "bytes": 100},
        {**FLOWS[0], "flow_id": "G-2", "packets": 7, "bytes": 400},
    ])
    try:
        edges = build_graph()["edges"]
        assert len(edges) == 1
        assert sorted(edges[0]["flow_ids"]) == ["G-1", "G-2"]
        assert edges[0]["packets"] == 10 and edges[0]["bytes"] == 500
    finally:
        setup_module()


def test_internal_node_that_only_receives_is_a_service():
    kinds = {n["id"]: n["kind"] for n in build_graph()["nodes"]}
    assert kinds["192.168.1.10"] == "internal"   # initiates, never receives
    assert kinds["192.168.1.11"] == "internal"   # both receives and initiates
    assert kinds["10.0.0.6"] == "service"        # only ever a destination
    assert kinds["203.0.113.9"] == "external"


def test_risk_propagates_to_both_endpoints():
    risk = {n["id"]: n["risk"] for n in build_graph()["nodes"]}
    assert risk["192.168.1.11"] > 0 and risk["203.0.113.9"] > 0
    assert risk["10.0.0.5"] == 0


def test_shortest_path_two_hops():
    result = shortest_path("192.168.1.10", "203.0.113.9")
    assert [step["name"] for step in result["path"]] == [
        "192.168.1.10", "192.168.1.11", "203.0.113.9"
    ]
    assert result["hops"] == 2
    assert result["suspicious"] == 1


def test_no_path_and_unknown_node_return_none():
    # Different components, and an IP that is not in the capture at all.
    assert shortest_path("192.168.1.10", "10.0.0.6") is None
    assert shortest_path("192.168.1.10", "8.8.8.8") is None


def test_same_node_is_zero_hops():
    result = shortest_path("192.168.1.10", "192.168.1.10")
    assert result["hops"] == 0 and len(result["path"]) == 1


def test_entities_sorted_by_risk():
    entities = build_entities()
    risks = [e["risk"] for e in entities]
    assert risks == sorted(risks, reverse=True)
    assert all("connections" in e for e in entities)


if __name__ == "__main__":
    setup_module()
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok  {name}")
    store.reset()
