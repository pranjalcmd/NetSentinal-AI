import { adaptBackendGraph, buildGraphFromFlows } from '../graph-adapter';
import { RawBackendGraphNode, RawBackendGraphEdge, CanonicalFlow } from '../api';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[TEST FAILED] ${message}`);
  }
}

console.log('Running Graph Adapter Invariant Verification Tests...');

// 1. Test Invariant: Edge with missing target node is rejected
const mockRawNodes: RawBackendGraphNode[] = [
  { id: '10.0.0.1', label: '10.0.0.1', kind: 'internal', risk: 10 },
  { id: '10.0.0.2', label: '10.0.0.2', kind: 'internal', risk: 20 },
];

const mockRawEdges: RawBackendGraphEdge[] = [
  { id: 'e1', source: '10.0.0.1', target: '10.0.0.2', flow_ids: ['f1'], bytes: 100, packets: 2, risk: 10 },
  { id: 'e2', source: '10.0.0.1', target: '99.99.99.99', flow_ids: ['f2'], bytes: 200, packets: 4, risk: 50 }, // Missing target '99.99.99.99'
];

const result = adaptBackendGraph(mockRawNodes, mockRawEdges);

assert(result.nodes.length === 2, 'Should contain exactly 2 nodes');
assert(result.edges.length === 1, 'Should filter out invalid edge with missing target node');
assert(result.edges[0].id === 'e1', 'Edge e1 should be preserved');
assert(result.edges[0].flow_ids.includes('f1'), 'Edge e1 must map to real flow_id f1');

console.log('✓ Test 1 Passed: Graph adapter filters out edges with missing node IDs.');

// 2. Test Invariant: Build graph from Canonical Flows
const mockFlows: CanonicalFlow[] = [
  {
    flow_id: 'flow-101',
    timestamp: new Date().toISOString(),
    source_ip: '192.168.1.5',
    destination_ip: '1.1.1.1',
    packets: 10,
    bytes: 1024,
    duration_seconds: 1.2,
    ndpi_risks: [],
    metadata: {},
    ml_detection: { risk_score: 85 }
  }
];

const flowGraph = buildGraphFromFlows(mockFlows);
assert(flowGraph.nodes.length === 2, 'Flow graph should contain 2 nodes (src & dst)');
assert(flowGraph.edges.length === 1, 'Flow graph should contain 1 aggregated edge');
assert(flowGraph.edges[0].flow_ids.includes('flow-101'), 'Edge must map to flow_id flow-101');
assert(flowGraph.edges[0].severity === 'critical', 'Risk score 85 must map to critical severity');

console.log('✓ Test 2 Passed: Graph built from flows correctly maps flow_ids & severity.');
console.log('All Graph Adapter Invariant Tests Passed Successfully!');
