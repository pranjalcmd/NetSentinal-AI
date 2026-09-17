'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCaptures } from '@/lib/mock/services';
import type { Capture } from '@/lib/types';
import { formatBytes, formatDuration, formatTimestamp, truncateMiddle } from '@/lib/utils';

export default function CapturesPage() {
  const [captures, setCaptures] = useState<Capture[]>([]);

  useEffect(() => {
    getCaptures().then(setCaptures);
  }, []);

  const totalBytes = captures.reduce((acc, c) => acc + (c.sizeBytes || 0), 0);

  return (
    <div className="space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>CAPTURE ARCHIVE</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">pcaps & forensic buffer storage</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Evidence Captures
          </h1>
        </div>

        <div className="flex items-center gap-6 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Total Captures</span>
            <span className="text-[#E2E8F0] font-bold text-sm">{captures.length}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Volume On Disk</span>
            <span className="text-[#3DD9C4] font-bold text-sm">{formatBytes(totalBytes)}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Auto Preserved</span>
            <span className="text-[#3DD9C4] font-bold text-sm">
              {captures.filter(c => c.type === 'AUTO_PRESERVED').length}
            </span>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-4">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2 mb-3">
          <span>FORENSIC CAPTURE INDEX</span>
          <span>SHA-256 VERIFIED RECORDINGS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.72rem] border-collapse">
            <thead>
              <tr className="border-b border-[#1E293B]/80 text-[#7C8798] uppercase text-[0.65rem] tracking-wider bg-[#090d16]">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Capture ID</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Sensor</th>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3 text-right">Duration</th>
                <th className="py-2.5 px-3 text-right">Size</th>
                <th className="py-2.5 px-3">SHA-256 Hash</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/40">
              {captures.map((cap) => (
                <tr key={cap.id} className="hover:bg-[#0F172A]/40 transition-colors">
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider border ${
                      cap.status === 'READY' || cap.status === 'ANALYZED' ? 'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5' :
                      cap.status === 'BUFFERING' || cap.status === 'RECORDING' ? 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5' :
                      'border-[#7C8798]/40 text-[#7C8798] bg-[#7C8798]/5'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        cap.status === 'READY' || cap.status === 'ANALYZED' ? 'bg-[#3DD9C4]' : 'bg-[#F59E0B] animate-pulse'
                      }`} />
                      {cap.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#3DD9C4]">{cap.id}</td>
                  <td className="py-3 px-3 text-[#E2E8F0] font-bold">{cap.type}</td>
                  <td className="py-3 px-3 text-[#94A3B8]">{cap.sensorId || '—'}</td>
                  <td className="py-3 px-3 text-[#94A3B8]">{cap.startTime ? formatTimestamp(cap.startTime) : '—'}</td>
                  <td className="py-3 px-3 text-right text-[#94A3B8]">{cap.durationSec ? formatDuration(cap.durationSec) : '—'}</td>
                  <td className="py-3 px-3 text-right font-bold text-[#E2E8F0]">{formatBytes(cap.sizeBytes || 0)}</td>
                  <td className="py-3 px-3 text-[#7C8798] font-mono">{cap.sha256 ? truncateMiddle(cap.sha256, 16) : '—'}</td>
                  <td className="py-3 px-3 text-right">
                    <Link
                      href={`/captures/${cap.id}`}
                      className="px-2.5 py-1 text-[0.65rem] uppercase tracking-wider border border-[#3DD9C4]/40 text-[#3DD9C4] hover:bg-[#3DD9C4]/10 transition-colors"
                    >
                      INSPECT →
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
