'use client';

import React, { useState } from 'react';
import NetworkMesh from '@/components/network/NetworkMesh';
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
} from 'lucide-react';

export default function NetworkMeshPage() {
  const [selectedHostFilter, setSelectedHostFilter] = useState('all');
  const [minRiskScore, setMinRiskScore] = useState(0);
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [mode, setMode] = useState<'traffic' | 'threat' | 'incident' | 'host'>('threat');

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Filter & Toolbar */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Flagship Network Mesh Topology
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono">
                Interactive Graph
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Real-time graph visualization of internal hosts, external destinations, and C2 traffic flows
            </p>
          </div>
        </div>

        {/* Filters Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setMode('threat')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                mode === 'threat' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Threat Mesh
            </button>
            <button
              onClick={() => setMode('traffic')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                mode === 'traffic' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Traffic Density
            </button>
            <button
              onClick={() => setMode('incident')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                mode === 'incident' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Incident Focus
            </button>
          </div>

          {/* Host Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Host:</span>
            <select
              value={selectedHostFilter}
              onChange={e => setSelectedHostFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Internal Hosts</option>
              <option value="10.0.0.14">10.0.0.14 (FIN-WS-014)</option>
              <option value="10.0.0.28">10.0.0.28 (DEV-WS-028)</option>
              <option value="10.0.0.2">10.0.0.2 (CORE-DNS-01)</option>
            </select>
          </div>

          {/* Min Risk Filter */}
          <div className="flex items-center gap-2 text-xs bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            <span className="text-slate-400">Min Risk:</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minRiskScore}
              onChange={e => setMinRiskScore(Number(e.target.value))}
              className="w-20 accent-cyan-500"
            />
            <span className="font-mono text-cyan-400 font-bold w-6">{minRiskScore}+</span>
          </div>

          {/* Protocol Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Protocol:</span>
            <select
              value={protocolFilter}
              onChange={e => setProtocolFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Protocols</option>
              <option value="tls">TLS 1.3 / HTTPS</option>
              <option value="dns">DNS Queries</option>
              <option value="tcp">Raw TCP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Embedded Fullscreen Network Mesh Container */}
      <div className="relative flex-1 w-full h-full bg-slate-950">
        <NetworkMesh mode={mode} height="100%" showControls={true} showMinimap={true} />

        {/* Legend Overlay Panel */}
        <div className="absolute left-4 bottom-4 z-10 p-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md space-y-3 max-w-xs shadow-2xl pointer-events-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Topology Legend</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded bg-cyan-500 border border-cyan-400" />
                Internal Host Workstation
              </span>
              <span className="font-mono text-[10px] text-slate-500">10.0.0.0/24</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded bg-red-500 border border-red-400 animate-pulse" />
                Critical C2 / Malicious IP
              </span>
              <span className="font-mono text-[10px] text-red-400">Rare Destination</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded bg-orange-500 border border-orange-400" />
                DNS Tunneling Destination
              </span>
              <span className="font-mono text-[10px] text-orange-400">High Entropy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-3 h-3 rounded bg-slate-600 border border-slate-500" />
                Legitimate CDN / Gateway
              </span>
              <span className="font-mono text-[10px] text-slate-400">Common</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Sidebar Overlay */}
        <div className="absolute right-4 top-4 z-10 p-4 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md space-y-3 w-64 shadow-2xl pointer-events-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Graph Dynamics Stats
          </h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Nodes Rendered:</span>
              <span className="text-white font-bold">12 Nodes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Edges Active:</span>
              <span className="text-cyan-300 font-bold">18 Flows</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Beaconing Edges:</span>
              <span className="text-red-400 font-bold">3 Beacon Streams</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">DPI Engine:</span>
              <span className="text-emerald-400">Active DPI v2.8</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
