'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  Search,
  RefreshCw,
  Server,
  Activity,
  ShieldAlert,
  Cpu,
  Radio,
} from 'lucide-react';
import { getServices } from '@/lib/mock/services';
import type { NetworkService } from '@/lib/types';
import { RiskBadge } from '@/components/ui/Badge';

export default function NetworkServicesPage() {
  const [services, setServices] = useState<NetworkService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [protoFilter, setProtoFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getServices();
      setServices(data);
    } catch (err) {
      console.error('Failed to load network services inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  // Setting state from the promise rather than from the effect body: a
  // synchronous setState in an effect is the cascading-render case.
  useEffect(() => {
    let live = true;
    getServices()
      .then((data) => { if (live) { setServices(data); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const filteredServices = useMemo(() => {
    return services.filter(s => {
      if (protoFilter !== 'all' && s.transport !== protoFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchIp = s.ip.includes(q);
        const matchPort = s.port.toString().includes(q);
        const matchApp = s.application ? s.application.toLowerCase().includes(q) : false;
        if (!matchIp && !matchPort && !matchApp) return false;
      }
      return true;
    });
  }, [services, protoFilter, searchQuery]);

  const totalServices = services.length;
  const totalFlows = services.reduce((sum, s) => sum + s.flows, 0);

  // Both of these used to be fixed strings, which read as measurements.
  const transportMix = useMemo(() => {
    const counts = services.reduce<Record<string, number>>((acc, s) => {
      acc[s.transport] = (acc[s.transport] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t.toUpperCase()} ${n}`)
      .join(' · ');
  }, [services]);

  const busiestPorts = useMemo(() => {
    const byPort = new Map<number, { port: number; app: string; flows: number }>();
    for (const s of services) {
      const seen = byPort.get(s.port);
      if (seen) seen.flows += s.flows;
      else byPort.set(s.port, { port: s.port, app: s.application ?? '', flows: s.flows });
    }
    return [...byPort.values()].sort((a, b) => b.flows - a.flows).slice(0, 3);
  }, [services]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                Network Services & Application Inventory
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                  {totalServices} Open Services
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Observed listening services, application-layer DPI classifications, open ports, and connection frequencies
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Inventory
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Total Monitored Services</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">{totalServices} Services</div>
          <div className="text-[11px] text-slate-500 mt-1">Across monitored hosts</div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Total Service Flows</span>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{totalFlows.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total connections established</div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Transport Mix</span>
          <div className="text-sm font-bold text-slate-200 mt-2 font-mono">{transportMix || '—'}</div>
          <div className="text-[11px] text-slate-500 mt-1">observed across services</div>
        </div>

        <div className="p-4 rounded-xl glass backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Busiest Ports</span>
          <div className="text-xs font-mono font-bold text-emerald-400 mt-2">
            {busiestPorts.length
              ? busiestPorts.map((p) => `${p.port} ${p.app}`).join(' · ')
              : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">by connection count</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl glass backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by IP, Port (443, 53, 8443), or application protocol (TLS, DNS)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Protocol Filter */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-medium whitespace-nowrap">Transport Protocol:</span>
          {['all', 'tcp', 'udp'].map(tp => (
            <button
              key={tp}
              onClick={() => setProtoFilter(tp)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium uppercase transition-colors whitespace-nowrap ${
                protoFilter === tp
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              {tp}
            </button>
          ))}
        </div>
      </div>

      {/* Services Inventory Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden backdrop-blur-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500" />
            <p className="text-sm">Loading services inventory...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Risk Score</th>
                  <th className="py-3.5 px-4">Port Number</th>
                  <th className="py-3.5 px-4">Transport</th>
                  <th className="py-3.5 px-4">Host IP</th>
                  <th className="py-3.5 px-4">Application Layer (DPI)</th>
                  <th className="py-3.5 px-4">Total Flows</th>
                  <th className="py-3.5 px-4">Connecting Sources</th>
                  <th className="py-3.5 px-4">First / Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredServices.map(srv => (
                  <tr key={srv.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-4 px-4 whitespace-nowrap">
                      <RiskBadge score={srv.riskScore} />
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap font-mono">
                      <span className="px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold text-sm">
                        {srv.port}
                      </span>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap uppercase font-mono font-semibold text-slate-300">
                      {srv.transport}
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-200">
                      <Link href={`/network/hosts/${srv.ip}`} className="hover:text-cyan-300 hover:underline">
                        {srv.ip}
                      </Link>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-200">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {srv.application ?? 'TLS 1.3'}
                      </span>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-300">
                      {srv.flows.toLocaleString()}
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap font-mono text-slate-400 text-[11px]">
                      {srv.sources.length} Sources ({srv.sources.join(', ')})
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                      <div><span className="text-slate-300">Last:</span> {new Date(srv.lastSeen).toLocaleTimeString()}</div>
                      <div className="text-slate-500">First: {new Date(srv.firstSeen).toLocaleTimeString()}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
