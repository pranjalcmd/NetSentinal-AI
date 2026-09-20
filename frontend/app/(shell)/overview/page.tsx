'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  ShieldAlert,
  AlertTriangle,
  Server,
  RefreshCw,
  Filter,
  Search,
  CheckCircle2,
  X,
  FileText,
  Clock,
  ArrowRight,
  Database,
  Layers,
  BarChart2
} from 'lucide-react';
import {
  getHealth,
  HealthResponse,
  getDashboard,
  getNetworkGraph,
  getAlerts,
  getFlows,
  getJobs,
  loadJob,
  CanonicalFlow,
  CanonicalAlert,
  AnalysisJob
} from '@/lib/api';
import { adaptBackendGraph, buildGraphFromFlows, ValidatedGraph, RenderGraphNode, RenderGraphEdge } from '@/lib/graph-adapter';
import { useNow } from '@/lib/useApi';
import { InteractiveNetworkMesh } from '../../../components/network/InteractiveNetworkMesh';

export default function SOCOverviewDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');

  // Backend Data
  const [rawGraph, setRawGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [flows, setFlows] = useState<CanonicalFlow[]>([]);
  const [alerts, setAlerts] = useState<CanonicalAlert[]>([]);
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>('demo');

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Elements (Pinned Graph Context)
  const [selectedNode, setSelectedNode] = useState<RenderGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<RenderGraphEdge | null>(null);

  // Load All Dashboard Telemetry
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphRes, flowsRes, alertsRes, jobsRes, healthRes] = await Promise.all([
        getNetworkGraph().catch(() => ({ nodes: [], edges: [] })),
        getFlows().catch(() => []),
        getAlerts().catch(() => []),
        getJobs().catch(() => []),
        getHealth().catch(() => null),
      ]);

      setRawGraph(graphRes);
      setFlows(flowsRes);
      setAlerts(alertsRes);
      setJobs(jobsRes);

      // Check staleness (if last event older than 5 mins)
      if (healthRes && healthRes.flows_loaded === 0 && flowsRes.length === 0) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Failed to load telemetry from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let live = true;
    Promise.all([
      getNetworkGraph().catch(() => ({ nodes: [], edges: [] })),
      getFlows().catch(() => []),
      getAlerts().catch(() => []),
      getJobs().catch(() => []),
      getDashboard().catch(() => null),
      getHealth().catch(() => null),
    ]).then(([g, f, a, j, d, h]) => {
      if (!live) return;
      setRawGraph(g); setFlows(f); setAlerts(a); setJobs(j); setSummary(d); setHealth(h);
      setLastRefreshed(new Date().toLocaleTimeString());
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  // Handle Capture Reload
  const handleJobSelect = async (jobId: string) => {
    setSelectedJobId(jobId);
    if (jobId !== 'demo') {
      try {
        await loadJob(jobId);
      } catch (e) {}
    }
    fetchDashboardData();
  };

  // Canonical Graph Adapter Output
  const graph: ValidatedGraph = useMemo(() => {
    if (rawGraph.nodes && rawGraph.nodes.length > 0) {
      return adaptBackendGraph(rawGraph.nodes, rawGraph.edges);
    }
    return buildGraphFromFlows(flows);
  }, [rawGraph, flows]);

  // Filtered Graph Nodes & Edges
  const filteredGraph = useMemo(() => {
    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;

    if (severityFilter !== 'all') {
      filteredEdges = filteredEdges.filter((e) => e.severity === severityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter((n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q));
      const validNodeIds = new Set(filteredNodes.map((n) => n.id));
      filteredEdges = filteredEdges.filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target));
    }

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      nodeMap: new Map(filteredNodes.map((n) => [n.id, n])),
    };
  }, [graph, severityFilter, searchQuery]);

  // Derived SOC KPIs (PRD Section 4)
  const kpis = useMemo(() => ({
    totalFlows: summary?.total_flows ?? flows.length,
    suspiciousFlows: summary?.suspicious_flows ?? 0,
    highRiskFlows: summary?.high_risk ?? 0,
    totalIncidents: summary?.incidents ?? 0,
  }), [summary, flows]);

  // Top Risky Entities & Incidents (Right Rail)
  // Age of the last analysis, reported rather than assumed.
  const now = useNow();
  const freshness = useMemo(() => {
    const at = jobs[0]?.created_at ? new Date(jobs[0].created_at).getTime() : null;
    if (!at || !now) return { label: '—', stale: false };
    const mins = Math.round((now - at) / 60000);
    if (mins < 1) return { label: 'Live', stale: false };
    if (mins < 5) return { label: `${mins}m ago`, stale: false };
    if (mins < 60) return { label: `${mins}m ago`, stale: true };
    return { label: `${Math.round(mins / 60)}h ago`, stale: true };
  }, [jobs, now]);

  const protocolMix = useMemo(() => {
    const dist: Record<string, number> = summary?.protocol_distribution ?? {};
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    if (!total) return [];
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([proto, n]) => ({ proto, pct: Math.round((n / total) * 100) }));
  }, [summary]);

  const topIncident = alerts[0];
  const topRiskyDestination = useMemo(() => {
    return graph.nodes.filter((n) => n.kind === 'external').sort((a, b) => b.risk - a.risk)[0];
  }, [graph]);

  const topNoisyHost = useMemo(() => {
    return graph.nodes.filter((n) => n.kind === 'internal').sort((a, b) => b.flow_count - a.flow_count)[0];
  }, [graph]);

  return (
    <div className="min-h-screen bg-[#04060c] text-white font-sans p-4 sm:p-6 space-y-6">
      
      {/* ─── Header: SOC Workstation Bar (PRD Section 4) ──────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl glass shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#3DD9C4]/10 border border-[#3DD9C4]/30 flex items-center justify-center text-[#3DD9C4]">
            <Activity className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">{jobs[0]?.filename ?? 'No capture loaded'}</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                freshness.stale ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                {freshness.stale ? 'STALE' : 'LIVE'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Refreshed: {lastRefreshed} • {kpis.totalFlows} normalized flows in active store
            </p>
          </div>
        </div>

        {/* Capture Selector & Action Toolbar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-[#3DD9C4]" />
            <select
              value={selectedJobId}
              onChange={(e) => handleJobSelect(e.target.value)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="demo">Live Traffic Ingest (Active Pipeline)</option>
              {jobs.map((j) => (
                <option key={j.job_id} value={j.job_id}>
                  {j.filename} ({j.status})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 transition-colors"
            title="Refresh telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#3DD9C4]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error & Retry State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span>Backend telemetry error: {error}</span>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1 rounded bg-red-900 hover:bg-red-800 text-xs font-mono text-white"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* ─── KPI Rail (PRD Section 4) ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'TOTAL FLOWS', val: kpis.totalFlows, sub: 'Normalized metadata', color: 'text-white' },
          { label: 'SUSPICIOUS FLOWS', val: kpis.suspiciousFlows, sub: 'Rule / DPI matches', color: 'text-amber-400' },
          { label: 'HIGH-RISK FLOWS', val: kpis.highRiskFlows, sub: 'ML Anomaly > 75%', color: 'text-orange-400' },
          { label: 'ACTIVE INCIDENTS', val: kpis.totalIncidents, sub: 'Correlated alerts', color: 'text-red-400' },
          { label: 'FRESHNESS', val: freshness.label, sub: 'Last analysis', color: freshness.stale ? 'text-amber-400' : 'text-[#3DD9C4]' },
        ].map((kpi, idx) => (
          <div key={idx} className="p-4 rounded-xl glass flex flex-col justify-between">
            <span className="text-[11px] font-mono text-zinc-500 tracking-wider">{kpi.label}</span>
            <div className={`text-2xl font-extrabold font-mono mt-1 ${kpi.color}`}>{kpi.val}</div>
            <span className="text-[10px] text-zinc-500 mt-1">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* ─── Main SOC Canvas + Right Rail ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Area: Connected 2D/3D Network Mesh (PRD Section 4) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-4 rounded-2xl glass relative">
            
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-white/10 text-xs font-mono">
              <div className="flex items-center gap-2 text-zinc-300">
                <Layers className="w-4 h-4 text-[#3DD9C4]" />
                <span className="font-bold">CONNECTED NETWORK MESH</span>
                <span className="text-zinc-500">({filteredGraph.nodes.length} nodes, {filteredGraph.edges.length} edges)</span>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="bg-zinc-900 text-zinc-300 border border-white/10 rounded px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                <div className="relative">
                  <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Filter IP/Host..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-zinc-900 text-zinc-200 border border-white/10 rounded pl-7 pr-2 py-1 text-xs focus:outline-none w-32"
                  />
                </div>
              </div>
            </div>

            {/* Interactive Network Mesh Viewport */}
            <div className="w-full h-[500px] rounded-xl overflow-hidden relative bg-zinc-950/90 border border-white/5">
              {loading ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-3 font-mono text-xs text-zinc-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#3DD9C4]" />
                  <span>Projecting backend network mesh...</span>
                </div>
              ) : filteredGraph.nodes.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-2 font-mono text-xs text-zinc-500">
                  <Server className="w-8 h-8 opacity-40" />
                  <span>No connected entities found matching criteria.</span>
                </div>
              ) : (
                <InteractiveNetworkMesh
                  nodes={filteredGraph.nodes}
                  edges={filteredGraph.edges}
                  onSelectNode={(n) => { setSelectedNode(n); setSelectedEdge(null); }}
                  onSelectEdge={(e) => { setSelectedEdge(e); setSelectedNode(null); }}
                />
              )}
            </div>

          </div>
        </div>

        {/* Right Rail: SOC Threat Highlights (PRD Section 4) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Top Active Incident */}
          <div className="p-4 rounded-xl glass space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">TOP ACTIVE INCIDENT</span>
            {topIncident ? (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 space-y-1">
                <div className="text-xs font-bold text-red-300">{topIncident.title}</div>
                <div className="text-[11px] text-zinc-400 leading-tight">{topIncident.description || 'Anomalous traffic burst detected'}</div>
                <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-zinc-500">
                  <span>Risk Score: {topIncident.risk_score}</span>
                  <Link href={`/alerts`} className="text-[#3DD9C4] hover:underline flex items-center gap-1">
                    <span>Investigate</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 font-mono">No active incidents reported.</div>
            )}
          </div>

          {/* Top Risky Destination */}
          <div className="p-4 rounded-xl glass space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">TOP RISKY DESTINATION</span>
            {topRiskyDestination ? (
              <div className="p-3 rounded-lg glass flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white font-mono">{topRiskyDestination.label}</div>
                  <div className="text-[10px] text-zinc-400">External Endpoint</div>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Risk: {topRiskyDestination.risk}
                </span>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 font-mono">No external risk endpoints.</div>
            )}
          </div>

          {/* Top Noisy Host */}
          <div className="p-4 rounded-xl glass space-y-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">TOP NOISY HOST</span>
            {topNoisyHost ? (
              <div className="p-3 rounded-lg glass flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white font-mono">{topNoisyHost.label}</div>
                  <div className="text-[10px] text-zinc-400">Internal Asset</div>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#3DD9C4]/10 text-[#3DD9C4] border border-[#3DD9C4]/30">
                  {topNoisyHost.flow_count} flows
                </span>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 font-mono">No host activity logged.</div>
            )}
          </div>

          {/* Selection Detail Drawer (PRD Section 4) */}
          {(selectedNode || selectedEdge) && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-[#3DD9C4]/40 space-y-3 relative">
              <button
                onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
                className="absolute top-3 right-3 text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-xs font-bold font-mono text-[#3DD9C4]">
                {selectedNode ? `ENTITY DETAILS: ${selectedNode.label}` : `FLOW EDGE: ${selectedEdge?.source} -> ${selectedEdge?.target}`}
              </div>

              {selectedNode && (
                <div className="text-xs font-mono text-zinc-300 space-y-1">
                  <div>Kind: <span className="text-white capitalize">{selectedNode.kind}</span></div>
                  <div>Risk Score: <span className="text-amber-400 font-bold">{selectedNode.risk}</span></div>
                  <div>Flow Count: <span className="text-white">{selectedNode.flow_count}</span></div>
                </div>
              )}

              {selectedEdge && (
                <div className="text-xs font-mono text-zinc-300 space-y-1">
                  <div>Application: <span className="text-white">{selectedEdge.application}</span></div>
                  <div>Volume: <span className="text-white">{(selectedEdge.bytes / 1024).toFixed(1)} KB ({selectedEdge.packets} pkts)</span></div>
                  <div>Risk Score: <span className="text-amber-400 font-bold">{selectedEdge.risk}</span></div>
                  <div>Related Flow IDs: <span className="text-zinc-500 block truncate">{selectedEdge.flow_ids.join(', ')}</span></div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* ─── Lower Area: Protocol Mix & Recent Alerts (PRD Section 4) ───────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
        
        {/* Recent Security Alerts */}
        <div className="p-4 rounded-xl glass space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              RECENT ALERTS ({alerts.length})
            </span>
            <Link href="/findings" className="text-[#3DD9C4] hover:underline">View All</Link>
          </div>

          <div className="space-y-2">
            {alerts.slice(0, 4).map((a, idx) => (
              <div key={idx} className="p-2.5 rounded bg-black border border-white/5 flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="text-zinc-200 font-semibold">{a.title}</div>
                  <div className="text-[10px] text-zinc-500">Flow: {a.flow_id}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  a.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {a.severity.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Protocol Mix Summary */}
        <div className="p-4 rounded-xl glass space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-white flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-[#3DD9C4]" />
              TRAFFIC PROTOCOL MIX
            </span>
            <span className="text-zinc-500">L4/L7 Inspection</span>
          </div>

          <div className="space-y-3 pt-2">
            {protocolMix.length === 0 ? (
              <p className="text-xs text-zinc-600">No protocols identified yet.</p>
            ) : protocolMix.map((p) => (
              <div key={p.proto} className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>{p.proto}</span>
                  <span className="text-white font-bold">{p.pct}%</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                  <div className="bg-[#3DD9C4] h-full rounded-full" style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* System state — the few real facts the standalone health page carried. */}
      <div className="glass px-6 py-4 flex flex-wrap items-center gap-x-10 gap-y-3 font-mono text-[11px]">
        <span className="eyebrow">System</span>
        {[
          ['API', health ? health.status : 'unreachable'],
          ['DPI engine', health?.dpi_mode ?? '—'],
          ['ML model', health ? (health.ml_trained_model ? 'trained' : 'heuristic only') : '—'],
          ['AI provider', health ? (health.ai_key_configured ? health.ai_provider : 'mock (no key)') : '—'],
          ['Flows in store', health?.flows_loaded ?? '—'],
        ].map(([k, v]) => (
          <span key={String(k)} className="flex items-center gap-2">
            <span className="text-zinc-600">{k}</span>
            <span className="text-zinc-200">{String(v)}</span>
          </span>
        ))}
        {health?.ai_last_error && (
          <span className="text-amber-400/80 max-w-xl truncate" title={health.ai_last_error}>
            last AI error: {health.ai_last_error}
          </span>
        )}
      </div>

    </div>
  );
}
