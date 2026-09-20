'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Network,
  Filter,
  ShieldAlert,
  Search,
  Maximize2,
  RefreshCw,
  Layers,
  Activity,
  Globe,
  Server,
  Zap,
  ArrowRight,
  X
} from 'lucide-react';
import { getNetworkGraph, getFlows, getAlerts, CanonicalFlow, CanonicalAlert } from '@/lib/api';
import { adaptBackendGraph, buildGraphFromFlows, ValidatedGraph, RenderGraphNode, RenderGraphEdge } from '@/lib/graph-adapter';
import { InteractiveNetworkMesh } from '@/components/network/InteractiveNetworkMesh';

export default function NetworkMeshPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'traffic' | 'threat' | 'incident' | 'host'>('threat');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [rawGraph, setRawGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [flows, setFlows] = useState<CanonicalFlow[]>([]);
  const [alerts, setAlerts] = useState<CanonicalAlert[]>([]);

  const [selectedNode, setSelectedNode] = useState<RenderGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<RenderGraphEdge | null>(null);

  // Fetch and apply are separate so that nothing is set synchronously inside
  // the effect below — that is the cascading-render case React warns about.
  const fetchAll = () =>
    Promise.all([
      getNetworkGraph().catch(() => ({ nodes: [], edges: [] })),
      getFlows().catch(() => []),
      getAlerts().catch(() => []),
    ]);

  const apply = ([gRes, fRes, aRes]: Awaited<ReturnType<typeof fetchAll>>) => {
    setRawGraph(gRes);
    setFlows(fRes);
    setAlerts(aRes);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    let live = true;
    fetchAll()
      .then((res) => { if (live) apply(res); })
      .catch((err) => { if (live) { setError(err?.message ?? 'Failed to load graph data'); setLoading(false); } });
    return () => { live = false; };
  }, []);

  const refresh = () => {
    setLoading(true);
    fetchAll()
      .then(apply)
      .catch((err) => { setError(err?.message ?? 'Failed to load graph data'); setLoading(false); });
  };

  const graph: ValidatedGraph = useMemo(() => {
    if (rawGraph.nodes && rawGraph.nodes.length > 0) {
      return adaptBackendGraph(rawGraph.nodes, rawGraph.edges);
    }
    return buildGraphFromFlows(flows);
  }, [rawGraph, flows]);

  const filteredGraph = useMemo(() => {
    let nodes = graph.nodes;
    let edges = graph.edges;

    if (severityFilter !== 'all') {
      edges = edges.filter((e) => e.severity === severityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter((n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
      const validNodeIds = new Set(nodes.map((n) => n.id));
      edges = edges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
    }

    return {
      nodes,
      edges,
      nodeMap: new Map(nodes.map((n) => [n.id, n])),
    };
  }, [graph, severityFilter, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#04060c] text-slate-100 font-sans">
      
      {/* Top Filter & Toolbar */}
      <div className="p-4 border-b border-white/10 bg-zinc-950/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 text-[#3DD9C4]">
            <Network className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Flagship Network Mesh Topology
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#3DD9C4]/20 border border-[#3DD9C4]/40 text-[#3DD9C4] font-mono">
                Interactive Graph ({filteredGraph.nodes.length} nodes, {filteredGraph.edges.length} edges)
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Real-time graph visualization of internal hosts, services, and external destination flows
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-white/10">
            {(['threat', 'traffic', 'incident'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded font-medium transition-colors capitalize ${
                  mode === m ? 'bg-[#3DD9C4] text-black font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {m} Focus
              </button>
            ))}
          </div>

          {/* Severity filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="glass rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search IP / Host..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 focus:outline-none w-36"
            />
          </div>

          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300"
            title="Refresh graph"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3DD9C4]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Interactive Mesh Canvas */}
      <div className="relative flex-1 min-h-0 w-full bg-[#04060c]">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-3 font-mono text-xs text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-[#3DD9C4]" />
            <span>Parsing topology graph...</span>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-2 font-mono text-xs text-red-400">
            <ShieldAlert className="w-8 h-8 opacity-80" />
            <span>{error}</span>
          </div>
        ) : (
          <InteractiveNetworkMesh
            nodes={filteredGraph.nodes}
            edges={filteredGraph.edges}
            onSelectNode={(n) => { setSelectedNode(n); setSelectedEdge(null); }}
            onSelectEdge={(e) => { setSelectedEdge(e); setSelectedNode(null); }}
          />
        )}

        {/* Drawer Detail Overlay */}
        {(selectedNode || selectedEdge) && (
          <div className="absolute right-4 top-4 z-30 p-4 rounded-xl bg-black/95 border border-[#3DD9C4]/40 backdrop-blur-xl text-xs font-mono shadow-2xl w-80 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="font-bold text-[#3DD9C4]">
                {selectedNode ? `NODE: ${selectedNode.label}` : `EDGE: ${selectedEdge?.source} -> ${selectedEdge?.target}`}
              </span>
              <button
                onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedNode && (
              <div className="space-y-1.5 text-zinc-300">
                <div>Kind: <span className="text-white capitalize">{selectedNode.kind}</span></div>
                <div>Risk Score: <span className="text-amber-400 font-bold">{selectedNode.risk}/100</span></div>
                <div>Total Flows: <span className="text-white">{selectedNode.flow_count}</span></div>
                <div className="pt-2 border-t border-white/10 flex justify-end">
                  <Link href={`/flows`} className="text-[#3DD9C4] hover:underline flex items-center gap-1">
                    <span>View Related Flows</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            {selectedEdge && (
              <div className="space-y-1.5 text-zinc-300">
                <div>Application: <span className="text-white">{selectedEdge.application}</span></div>
                <div>Data Transferred: <span className="text-white">{(selectedEdge.bytes / 1024).toFixed(1)} KB</span></div>
                <div>Packets: <span className="text-white">{selectedEdge.packets}</span></div>
                <div>Risk Score: <span className="text-amber-400 font-bold">{selectedEdge.risk}/100</span></div>
                <div>Flow IDs: <span className="text-zinc-500 block truncate">{selectedEdge.flow_ids.join(', ')}</span></div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
