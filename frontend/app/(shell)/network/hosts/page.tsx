'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getHosts } from '@/lib/mock/services';
import type { Host } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

export default function HostsPage() {
  const [hosts, setHosts] = useState<Host[]>([]);

  useEffect(() => {
    getHosts().then(setHosts);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>ENDPOINTS LAYER</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">observed internal hosts & workstation risk baseline</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Internal Hosts
          </h1>
        </div>

        <div className="flex items-center gap-6 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Hosts Monitored</span>
            <span className="text-[#E2E8F0] font-bold text-sm">{hosts.length}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">High Risk Hosts</span>
            <span className="text-[#F43F5E] font-bold text-sm">
              {hosts.filter(h => h.riskScore >= 70).length}
            </span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="glass p-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
          <span>ENDPOINT INVENTORY</span>
          <span>REAL-TIME TRAFFIC PROFILES</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.72rem] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">IP Address</th>
                <th className="py-2.5 px-3">Hostname</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3 text-right">Flow Count</th>
                <th className="py-2.5 px-3 text-right">Outbound Volume</th>
                <th className="py-2.5 px-3 text-right">Inbound Volume</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/40">
              {hosts.map((host) => {
                const isHighRisk = host.riskScore >= 70;
                return (
                  <tr key={host.id} className="hover:bg-[#0F172A]/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[0.65rem] font-bold border ${
                        isHighRisk ? 'border-[#F43F5E]/40 text-[#F43F5E] bg-[#F43F5E]/5' :
                        host.riskScore >= 40 ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                        'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5'
                      }`}>
                        {host.riskScore} / 100
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{host.ip}</td>
                    <td className="py-3 px-3 font-bold text-[#E2E8F0]">{host.hostname || '—'}</td>
                    <td className="py-3 px-3 text-[#94A3B8]">{host.role || '—'}</td>
                    <td className="py-3 px-3 text-right text-[#94A3B8]">{host.flows?.toLocaleString() || 0}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">{formatBytes(host.bytesOut || 0)}</td>
                    <td className="py-3 px-3 text-right text-[#94A3B8]">{formatBytes(host.bytesIn || 0)}</td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/network/hosts/${host.id}`}
                        className="px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors"
                      >
                        PROFILE →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
