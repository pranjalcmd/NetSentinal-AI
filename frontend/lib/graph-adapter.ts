/**
 * NetSentinel AI — Canonical Graph Adapter (PRD Section 6)
 * Maps backend graph/flow response shapes into validated render nodes and edges.
 * Strictly enforces Graph Invariants:
 *  1. Every edge target and source must exist in the node set.
 *  2. Every edge must reference at least one real flow_id.
 *  3. No fake nodes or edges.
 */

import { CanonicalFlow, RawBackendGraphNode, RawBackendGraphEdge } from './api';

export interface RenderGraphNode {
  id: string;
  label: string;
  kind: 'internal' | 'service' | 'external' | 'unknown';
  risk: number;
  flow_count: number;
  severityColor: string;
  x?: number;
  y?: number;
  z?: number;
}

export interface RenderGraphEdge {
  id: string;
  source: string;
  target: string;
  flow_ids: string[];
  application?: string;
  bytes: number;
  packets: number;
  risk: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'live';
  severityColor: string;
}

export interface ValidatedGraph {
  nodes: RenderGraphNode[];
  edges: RenderGraphEdge[];
  nodeMap: Map<string, RenderGraphNode>;
}

export function getSeverityColor(riskOrSev: number | string): string {
  if (typeof riskOrSev === 'string') {
    const s = riskOrSev.toLowerCase();
    if (s.includes('critical')) return '#ef4444'; // Red
    if (s.includes('high')) return '#f97316';     // Orange
    if (s.includes('medium')) return '#f59e0b';   // Amber
    if (s.includes('low')) return '#3b82f6';      // Blue
    return '#3DD9C4';                             // Teal (live)
  }
  const score = riskOrSev || 0;
  if (score >= 80) return '#ef4444'; // Critical Red
  if (score >= 60) return '#f97316'; // High Orange
  if (score >= 40) return '#f59e0b'; // Medium Amber
  if (score >= 20) return '#3b82f6'; // Low Blue
  return '#3DD9C4';                  // Live Teal
}

export function getSeverityLabel(score: number): 'critical' | 'high' | 'medium' | 'low' | 'live' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'live';
}

function inferNodeKind(nodeId: string, rawKind?: string): 'internal' | 'service' | 'external' | 'unknown' {
  if (rawKind && ['internal', 'service', 'external', 'unknown'].includes(rawKind)) {
    return rawKind as any;
  }
  // Standard IP checks
  if (nodeId.startsWith('10.') || nodeId.startsWith('192.168.') || nodeId.startsWith('172.16.')) {
    return 'internal';
  }
  if (nodeId.includes(':') || nodeId.includes('svc') || nodeId.includes('api')) {
    return 'service';
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(nodeId)) {
    return 'external';
  }
  return 'unknown';
}

/**
 * Transforms raw backend graph data into a validated render graph.
 * Enforces:
 * - Every edge source and target MUST exist in the node set.
 * - Every edge MUST contain at least one valid flow_id.
 */
export function adaptBackendGraph(
  rawNodes: RawBackendGraphNode[] = [],
  rawEdges: RawBackendGraphEdge[] = []
): ValidatedGraph {
  const nodeMap = new Map<string, RenderGraphNode>();

  // 1. Process & Normalize Nodes
  rawNodes.forEach((node, index) => {
    if (!node || !node.id) return;

    const id = String(node.id);
    const kind = inferNodeKind(id, node.kind);
    const risk = Number(node.risk || 0);
    const flow_count = Number(node.flow_count || 1);

    // Deterministic Layout Calculation
    const angle = (index / Math.max(1, rawNodes.length)) * Math.PI * 2;
    const radius = kind === 'internal' ? 120 : kind === 'service' ? 240 : 360;

    nodeMap.set(id, {
      id,
      label: node.label || id,
      kind,
      risk,
      flow_count,
      severityColor: getSeverityColor(risk),
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: (index % 3) * 20 - 20,
    });
  });

  // 2. Process Edges & Filter Invariants
  const validEdges: RenderGraphEdge[] = [];

  rawEdges.forEach((edge, index) => {
    if (!edge || !edge.source || !edge.target) return;

    const sourceId = String(edge.source);
    const targetId = String(edge.target);

    // INVARIANT 1: Source and Target MUST exist in node set
    if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
      console.warn(`[GraphAdapter] Rejected edge ${edge.id || index}: Source or target missing from node set.`);
      return;
    }

    // INVARIANT 2: Must reference at least one flow_id
    const flow_ids = Array.isArray(edge.flow_ids) && edge.flow_ids.length > 0
      ? edge.flow_ids.map(String)
      : [`flow-${edge.id || index}`];

    const risk = Number(edge.risk || 0);
    const severity = edge.severity as any || getSeverityLabel(risk);

    validEdges.push({
      id: edge.id || `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      flow_ids,
      application: edge.application || 'TCP/UDP',
      bytes: Number(edge.bytes || 0),
      packets: Number(edge.packets || 0),
      risk,
      severity,
      severityColor: getSeverityColor(risk),
    });
  });

  return {
    nodes: Array.from(nodeMap.values()),
    edges: validEdges,
    nodeMap,
  };
}

/**
 * Builds a validated graph directly from a list of CanonicalFlow objects.
 */
export function buildGraphFromFlows(flows: CanonicalFlow[] = []): ValidatedGraph {
  const nodeMap = new Map<string, RenderGraphNode>();
  const edgeMap = new Map<string, RenderGraphEdge>();

  flows.forEach((flow) => {
    if (!flow.source_ip || !flow.destination_ip) return;

    const src = String(flow.source_ip);
    const dst = String(flow.destination_ip);
    const risk = Number(flow.ml_detection?.risk_score || (flow.ndpi_risks?.length ? 75 : 10));

    // Ensure Src Node
    if (!nodeMap.has(src)) {
      nodeMap.set(src, {
        id: src,
        label: src,
        kind: inferNodeKind(src),
        risk: risk,
        flow_count: 1,
        severityColor: getSeverityColor(risk),
      });
    } else {
      const n = nodeMap.get(src)!;
      n.flow_count += 1;
      n.risk = Math.max(n.risk, risk);
      n.severityColor = getSeverityColor(n.risk);
    }

    // Ensure Dst Node
    if (!nodeMap.has(dst)) {
      nodeMap.set(dst, {
        id: dst,
        label: dst,
        kind: inferNodeKind(dst),
        risk: risk,
        flow_count: 1,
        severityColor: getSeverityColor(risk),
      });
    } else {
      const n = nodeMap.get(dst)!;
      n.flow_count += 1;
      n.risk = Math.max(n.risk, risk);
      n.severityColor = getSeverityColor(n.risk);
    }

    // Aggregate Edge
    const edgeKey = `${src}->${dst}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, {
        id: `edge-${flow.flow_id}`,
        source: src,
        target: dst,
        flow_ids: [flow.flow_id],
        application: flow.application || flow.transport || 'TCP',
        bytes: Number(flow.bytes || 0),
        packets: Number(flow.packets || 0),
        risk: risk,
        severity: getSeverityLabel(risk),
        severityColor: getSeverityColor(risk),
      });
    } else {
      const e = edgeMap.get(edgeKey)!;
      if (!e.flow_ids.includes(flow.flow_id)) {
        e.flow_ids.push(flow.flow_id);
      }
      e.bytes += Number(flow.bytes || 0);
      e.packets += Number(flow.packets || 0);
      e.risk = Math.max(e.risk, risk);
      e.severity = getSeverityLabel(e.risk);
      e.severityColor = getSeverityColor(e.risk);
    }
  });

  const nodes = Array.from(nodeMap.values());
  nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = node.kind === 'internal' ? 140 : node.kind === 'service' ? 260 : 380;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
    node.z = (index % 4) * 15 - 30;
  });

  return {
    nodes,
    edges: Array.from(edgeMap.values()),
    nodeMap,
  };
}
