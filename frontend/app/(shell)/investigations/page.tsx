'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getInvestigations } from '@/lib/mock/services';
import type { Investigation } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);

  useEffect(() => {
    getInvestigations().then(setInvestigations);
  }, []);

  return (
    <div className="space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>FORENSICS PIPELINE</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">automated offline pcap parsing & incident evidence extraction</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Forensic Investigations
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/investigations/new/upload"
            className="px-3 py-1.5 text-[0.65rem] uppercase tracking-wider border border-[#1E293B] text-[#94A3B8] hover:border-[#3DD9C4]/40 hover:text-[#3DD9C4] bg-[#090d16] transition-colors"
          >
            UPLOAD PCAP
          </Link>
          <Link
            href="/investigations/new"
            className="px-3 py-1.5 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4] text-[#3DD9C4] hover:bg-[#3DD9C4]/10 bg-[#3DD9C4]/5 transition-colors font-bold"
          >
            + NEW INVESTIGATION
          </Link>
        </div>
      </div>

      {/* TABLE */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
          <span>PIPELINE EXECUTION LOG</span>
          <span>{investigations.length} JOBS RECORDED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.72rem] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Investigation ID</th>
                <th className="py-2.5 px-3">Target Capture</th>
                <th className="py-2.5 px-3">Analysis Profile</th>
                <th className="py-2.5 px-3">Started</th>
                <th className="py-2.5 px-3 text-right">Flows Processed</th>
                <th className="py-2.5 px-3 text-right">Findings</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/40">
              {investigations.map((inv) => (
                <tr key={inv.id} className="hover:bg-[#0F172A]/40 transition-colors">
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider font-bold border ${
                      inv.status === 'completed' ? 'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5' :
                      inv.status === 'running' ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                      'border-[#7C8798]/40 text-[#7C8798]'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{inv.id}</td>
                  <td className="py-3 px-3 font-bold text-[#E2E8F0]">{inv.captureId}</td>
                  <td className="py-3 px-3 text-[#94A3B8] uppercase text-[0.65rem]">{inv.profile}</td>
                  <td className="py-3 px-3 text-[#94A3B8]">{inv.createdAt ? formatTimestamp(inv.createdAt) : '—'}</td>
                  <td className="py-3 px-3 text-right text-[#94A3B8]">{inv.progress?.flowsProcessed?.toLocaleString() || 0}</td>
                  <td className="py-3 px-3 text-right font-bold text-[#3DD9C4]">{inv.findings?.length || 0}</td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/investigations/${inv.id}`}
                      className="px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors"
                    >
                      VIEW PIPELINE →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
