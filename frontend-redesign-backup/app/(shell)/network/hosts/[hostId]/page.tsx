'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Server,
  ArrowLeft,
  ShieldAlert,
  Activity,
  Globe,
  Radio,
  Clock,
  ArrowUpDown,
  FileCode,
  Download,
  AlertTriangle,
  HardDrive,
  Cpu,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { getHost, getFlows, getFindings, getDestinations } from '@/lib/mock/services';
import type { Host, Flow, Finding, Destination } from '@/lib/types';
import { RiskBadge, SeverityBadge, StatusBadge } from '@/components/ui/Badge';

export default function HostForensicsPage({ params }: { params?: Promise<{ hostId: string }> | { hostId: string } }) {
  const [hostId, setHostId] = useState<string>('');
  const [host, setHost] = useState<Host | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params) {
      if (typeof (params as Promise<any>).then === 'function') {
        (params as Promise<{ hostId: string }>).then(p => setHostId(p.hostId));
      } else {
        setHostId((params as { hostId: string }).hostId);
      }
    }
  }, [params]);

  useEffect(() => {
    if (!hostId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const hData = await getHost(hostId);
        setHost(hData);

        const [fData, findData, dData] = await Promise.all([
          getFlows({ srcIp: hData.ip }),
          getFindings(),
          getDestinations(),
        ]);

        setFlows(fData);
        setFindings(findData.filter(f => f.hostIds.includes(hData.id)));

        // Filter connected destinations
        const connectedDests = dData.filter(d => d.hosts.includes(hData.id));
        setDestinations(connectedDests);
      } catch (err) {
        console.error(`Error fetching host forensics for ${hostId}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [hostId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-3 min-h-screen">
        <Activity className="w-8 h-8 animate-spin mx-auto text-cyan-500" />
        <p className="text-sm font-mono">Loading Host Forensics Console...</p>
      </div>
    );
  }

  if (!host) {
    return (
      <div className="p-12 text-center space-y-4 min-h-screen">
        <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Host Not Found</h2>
        <p className="text-sm text-slate-400">Host ID {hostId} was not found in sensor telemetry.</p>
        <Link
          href="/network/hosts"
          className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800 text-cyan-400 border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Host Directory
        </Link>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <Link href="/network/hosts" className="hover:text-cyan-400 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Host Directory
            </Link>
            <span>/</span>
            <span className="font-mono text-cyan-400">{host.ip}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Host Forensics: {host.ip}
              {host.hostname && (
                <span className="text-sm px-3 py-1 rounded-md bg-slate-800 text-slate-300 font-mono font-normal">
                  {host.hostname}
                </span>
              )}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/traffic?srcIp=${host.ip}`}
            className="flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition-all"
          >
            <Activity className="w-4 h-4" />
            Explore Live Traffic Flows
          </Link>
        </div>
      </div>

      {/* Overview Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Host Risk Score</span>
          <div className="mt-1">
            <RiskBadge score={host.riskScore} />
          </div>
          <div className="text-[11px] text-slate-500 mt-2">Composite behavioral risk</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Role / Function</span>
          <div className="text-sm font-semibold text-white mt-1 capitalize font-mono">{host.role ?? 'Workstation'}</div>
          <div className="text-[11px] text-slate-500 mt-1">Monitored LAN segment</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Total Flows</span>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">{host.flows.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">Reconstructed sessions</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Bytes Outbound</span>
          <div className="text-xl font-bold font-mono text-orange-400 mt-1">{formatBytes(host.bytesOut)}</div>
          <div className="text-[11px] text-slate-500 mt-1">High volume anomaly</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Bytes Inbound</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{formatBytes(host.bytesIn)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Normal baseline</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
          <span className="text-xs font-medium text-slate-400 block mb-1">Associated Findings</span>
          <div className="text-2xl font-bold font-mono text-red-400 mt-1">{findings.length} Findings</div>
          <div className="text-[11px] text-slate-500 mt-1">Active detections</div>
        </div>
      </div>

      {/* Main Grid: Left Column for Connected Dests & Findings, Right for Flows Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (1 col): Connected Destinations & Findings */}
        <div className="space-y-6">
          {/* Associated Findings */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Active Findings ({findings.length})
              </span>
            </h2>

            <div className="space-y-3">
              {findings.map(f => (
                <Link
                  key={f.id}
                  href={`/findings/${f.id}`}
                  className="block p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/40 transition-colors space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-400 group-hover:underline">{f.id}</span>
                    <RiskBadge score={f.riskScore} size="sm" />
                  </div>
                  <div className="text-xs font-bold text-white group-hover:text-cyan-300">{f.title}</div>
                  <div className="text-[11px] text-slate-400 line-clamp-2">{f.description}</div>
                </Link>
              ))}

              {findings.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500 font-mono">
                  No open findings registered for host {host.ip}
                </div>
              )}
            </div>
          </div>

          {/* External Connected Destinations */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              Connected Destinations ({destinations.length})
            </h2>

            <div className="space-y-3">
              {destinations.map(dest => (
                <div key={dest.id} className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-xs font-bold text-slate-200">{dest.ip}</span>
                    <RiskBadge score={dest.riskScore} size="sm" />
                  </div>
                  {dest.domain && (
                    <div className="text-xs text-slate-400 font-mono truncate">{dest.domain}</div>
                  )}
                  {dest.asnOrg && (
                    <div className="text-[11px] text-slate-500">{dest.asnOrg}</div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 uppercase font-mono">
                      {dest.rarity}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Protocols: {dest.protocols.join(', ')}
                    </span>
                  </div>
                </div>
              ))}

              {destinations.length === 0 && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-xs font-bold text-slate-200">45.77.21.184</span>
                    <RiskBadge score={92} size="sm" />
                  </div>
                  <div className="text-[11px] text-slate-400">Choopa LLC (AS64514)</div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 uppercase font-mono">Rare Destination</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (2 cols): Flows Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Associated Flow Records ({flows.length})
                </h2>
                <p className="text-xs text-slate-400">Network flow records originated by {host.ip}</p>
              </div>

              <Link
                href={`/traffic?srcIp=${host.ip}`}
                className="text-xs font-semibold text-cyan-400 hover:underline flex items-center gap-1"
              >
                Open Full Flow Forensics →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-[11px] text-slate-400 font-semibold uppercase">
                    <th className="p-3">Start Time</th>
                    <th className="p-3">Destination</th>
                    <th className="p-3">Protocol</th>
                    <th className="p-3">Packets / Bytes</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {flows.slice(0, 15).map(fl => (
                    <tr key={fl.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-slate-300">
                        {new Date(fl.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="p-3 font-bold text-slate-200">
                        {fl.dstIp}:{fl.dstPort}
                        {fl.tls?.serverName && (
                          <span className="block text-[11px] text-slate-400 font-sans font-normal truncate max-w-[150px]">
                            {fl.tls.serverName}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                          {fl.application ?? fl.protocol}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {fl.packets} pkts / {(fl.bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="p-3 text-slate-400">{fl.duration}s</td>
                      <td className="p-3">
                        <RiskBadge score={fl.riskScore} size="sm" />
                      </td>
                    </tr>
                  ))}

                  {flows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 font-mono">
                        No flow records captured in current observation window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
