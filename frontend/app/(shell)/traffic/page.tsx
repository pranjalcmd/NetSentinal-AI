'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getFlows } from '@/lib/mock/services';
import type { Flow } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

export default function TrafficExplorerPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minRisk, setMinRisk] = useState(0);

  useEffect(() => {
    getFlows().then(res => setFlows(res || []));
  }, []);

  const filteredFlows = useMemo(() => {
    return flows.filter(fl => {
      if (fl.riskScore < minRisk) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSrc = fl.srcIp.includes(q);
        const matchDst = fl.dstIp.includes(q);
        const matchApp = fl.application ? fl.application.toLowerCase().includes(q) : false;
        if (!matchSrc && !matchDst && !matchApp) return false;
      }
      return true;
    });
  }, [flows, minRisk, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>FLOW LAYER</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">dpi flow reconstruction, ja3 fingerprints & session telemetry</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Network Flow Explorer
          </h1>
        </div>

        <div className="flex items-center gap-4 text-[0.7rem]">
          <input
            type="text"
            placeholder="FILTER IP / APP / JA3..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-[0.65rem] bg-[#090d16] border border-[#1E293B] text-[#E2E8F0] uppercase tracking-wider focus:outline-none focus:border-[#3DD9C4]/60 w-64"
          />
          <select
            value={minRisk}
            onChange={e => setMinRisk(Number(e.target.value))}
            className="px-3 py-1.5 text-[0.65rem] bg-[#090d16] border border-[#1E293B] text-[#E2E8F0] uppercase tracking-wider focus:outline-none focus:border-[#3DD9C4]/60"
          >
            <option value={0}>ALL RISK SCORES</option>
            <option value={50}>RISK &gt;= 50</option>
            <option value={75}>RISK &gt;= 75 (HIGH)</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT: TABLE & INSPECTION DRAWER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass p-4">
          <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
            <span>RECONSTRUCTED FLOW SESSIONS</span>
            <span>{filteredFlows.length} SESSIONS MATCHED</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.72rem] border-collapse">
              <thead>
                <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                  <th className="py-2.5 px-3">Risk</th>
                  <th className="py-2.5 px-3">Source IP</th>
                  <th className="py-2.5 px-3">Destination IP</th>
                  <th className="py-2.5 px-3">App / Protocol</th>
                  <th className="py-2.5 px-3 text-right">Bytes</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/40">
                {filteredFlows.map((fl) => (
                  <tr
                    key={fl.id}
                    onClick={() => setSelectedFlow(fl)}
                    className={`cursor-pointer transition-colors ${
                      selectedFlow?.id === fl.id ? 'bg-[#3DD9C4]/10 border-l-2 border-l-[#3DD9C4]' : 'hover:bg-[#0F172A]/40'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 text-[0.65rem] font-bold border ${
                        fl.riskScore >= 75 ? 'border-[#F43F5E]/40 text-[#F43F5E]' : 'border-[#3DD9C4]/40 text-[#3DD9C4]'
                      }`}>
                        {fl.riskScore}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{fl.srcIp}:{fl.srcPort}</td>
                    <td className="py-3 px-3 font-bold text-[#E2E8F0]">{fl.dstIp}:{fl.dstPort}</td>
                    <td className="py-3 px-3 text-[#94A3B8] uppercase text-[0.65rem]">{fl.application || fl.protocol}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">{formatBytes(fl.bytes || 0)}</td>
                    <td className="py-3 px-3 text-right text-[#3DD9C4] text-[0.65rem]">→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIDE DRAWER */}
        <div className="glass p-4 space-y-4">
          <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2">
            <span>SESSION TELEMETRY INSPECTOR</span>
            <span>{selectedFlow ? selectedFlow.id : 'SELECT ROW'}</span>
          </div>

          {selectedFlow ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[#7C8798] uppercase text-[0.6rem] tracking-wider block">SOURCE</span>
                <span className="font-bold text-[#3DD9C4]">{selectedFlow.srcIp}:{selectedFlow.srcPort}</span>
              </div>
              <div>
                <span className="text-[#7C8798] uppercase text-[0.6rem] tracking-wider block">DESTINATION</span>
                <span className="font-bold text-[#E2E8F0]">{selectedFlow.dstIp}:{selectedFlow.dstPort}</span>
              </div>
              <div>
                <span className="text-[#7C8798] uppercase text-[0.6rem] tracking-wider block">APPLICATION & CATEGORY</span>
                <span className="text-[#94A3B8]">{selectedFlow.application || 'TLS'} ({selectedFlow.dpiResult?.category || 'Encrypted'})</span>
              </div>
              {selectedFlow.tls && (
                <div className="border border-[#1E293B] bg-[#090d16] p-3 space-y-2 text-[0.7rem]">
                  <span className="text-[#3DD9C4] uppercase text-[0.6rem] tracking-wider block font-bold">TLS / SNI TELEMETRY</span>
                  <div>
                    <span className="text-[#7C8798]">SNI Server Name:</span>
                    <div className="font-bold text-[#E2E8F0]">{selectedFlow.tls.serverName || '—'}</div>
                  </div>
                  <div>
                    <span className="text-[#7C8798]">JA3 Fingerprint:</span>
                    <div className="font-mono text-[#3DD9C4] break-all text-[0.6rem]">{selectedFlow.tls.ja3 || '—'}</div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-[#7C8798] text-[0.7rem]">
              Select a flow row from the left table to inspect deep packet metrics & TLS fingerprint data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
