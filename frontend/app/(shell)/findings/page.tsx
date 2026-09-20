'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getFindings } from '@/lib/mock/services';
import type { Finding } from '@/lib/types';

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);

  useEffect(() => {
    getFindings().then(setFindings);
  }, []);

  const criticalCount = findings.filter(f => f.severity === 'critical' || f.riskScore >= 80).length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>DETECTION CORRELATION</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">evidence-backed anomalies & threat findings</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Correlated Findings
          </h1>
        </div>

        <div className="flex items-center gap-6 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Total Findings</span>
            <span className="text-[#E2E8F0] font-bold text-sm">{findings.length}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">High / Critical</span>
            <span className="text-[#F43F5E] font-bold text-sm">{criticalCount}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Open State</span>
            <span className="text-[#3DD9C4] font-bold text-sm">
              {findings.filter(f => f.status === 'open').length}
            </span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
          <span>THREAT FINDING REGISTRY</span>
          <span>MULTI-SIGNAL ANALYSIS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.72rem] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Finding ID</th>
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/40">
              {findings.map((finding) => {
                const isHigh = finding.riskScore >= 75;
                return (
                  <tr key={finding.id} className="hover:bg-[#0F172A]/40 transition-colors">
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[0.65rem] font-bold border ${
                        isHigh ? 'border-[#F43F5E]/40 text-[#F43F5E] bg-[#F43F5E]/5' :
                        finding.riskScore >= 50 ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                        'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5'
                      }`}>
                        {finding.riskScore} / 100
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{finding.id}</td>
                    <td className="py-3 px-3 font-bold text-[#E2E8F0]">{finding.title}</td>
                    <td className="py-3 px-3 text-[#94A3B8] uppercase text-[0.65rem] tracking-wider">{finding.category}</td>
                    <td className="py-3 px-3 text-[#94A3B8]">{finding.confidence}%</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 text-[0.6rem] uppercase tracking-wider border border-[#3DD9C4]/30 text-[#3DD9C4] bg-[#3DD9C4]/5">
                        {finding.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/findings/${finding.id}`}
                        className="px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors"
                      >
                        INSPECT →
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
