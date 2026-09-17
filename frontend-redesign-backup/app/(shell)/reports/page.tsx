'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getReports } from '@/lib/mock/services';
import type { Report } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    getReports().then(setReports);
  }, []);

  return (
    <div className="space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>DOCUMENTATION LAYER</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">executive incident summaries & technical assessment deliverables</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Assessment Reports
          </h1>
        </div>
      </div>

      {/* TABLE */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
          <span>REPORT ARCHIVE</span>
          <span>{reports.length} DOCUMENTS DRAFTED</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.72rem] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Report ID</th>
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Author</th>
                <th className="py-2.5 px-3">Created</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/40">
              {reports.map((rpt) => (
                <tr key={rpt.id} className="hover:bg-[#0F172A]/40 transition-colors">
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 text-[0.6rem] uppercase tracking-wider font-bold border border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5">
                      {rpt.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{rpt.id}</td>
                  <td className="py-3 px-3 font-bold text-[#E2E8F0]">{rpt.title}</td>
                  <td className="py-3 px-3 text-[#94A3B8] uppercase text-[0.65rem]">{rpt.type}</td>
                  <td className="py-3 px-3 text-[#94A3B8]">{rpt.createdBy || 'Consultant'}</td>
                  <td className="py-3 px-3 text-[#94A3B8]">{rpt.createdAt ? formatTimestamp(rpt.createdAt) : '—'}</td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/reports/${rpt.id}/edit`}
                      className="px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors"
                    >
                      EDIT REPORT →
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
