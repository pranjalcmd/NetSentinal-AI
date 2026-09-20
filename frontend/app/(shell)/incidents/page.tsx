'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getIncidents } from '@/lib/mock/services';
import type { Incident } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    getIncidents().then(setIncidents);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>INCIDENT COMMAND</span>
            <span className="text-[#F43F5E]/60">·</span>
            <span className="text-[#F43F5E] lowercase font-sans">response console & active threat cases</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Security Incidents
          </h1>
        </div>

        <div className="flex items-center gap-6 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Active Incidents</span>
            <span className="text-[#F43F5E] font-bold text-sm">{incidents.length}</span>
          </div>
          <div className="h-6 w-px bg-[#1E293B]/80" />
          <div>
            <span className="text-[#7C8798] uppercase tracking-wider block text-[0.6rem]">Investigating</span>
            <span className="text-[#F59E0B] font-bold text-sm">
              {incidents.filter(i => i.status === 'investigating').length}
            </span>
          </div>
        </div>
      </div>

      {/* INCIDENTS CARDS GRID */}
      <div className="space-y-4">
        {incidents.map((incident) => (
          <div key={incident.id} className="border border-[#F43F5E]/40 bg-[#090d16] p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#1E293B]/60 pb-3">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-[#F43F5E]/10 border border-[#F43F5E]/40 text-[#F43F5E]">
                  CRITICAL INCIDENT
                </span>
                <span className="text-xs font-semibold text-[#3DD9C4]">{incident.id}</span>
                <span className="text-xs text-[#7C8798]">·</span>
                <span className="text-xs text-[#7C8798]">First Seen: {formatTimestamp(incident.firstSeen)}</span>
              </div>
              <div className="flex items-center gap-4 text-[0.7rem]">
                <span className="text-[#7C8798]">Risk Score: <strong className="text-[#F43F5E]">{incident.riskScore}/100</strong></span>
                <span className="text-[#7C8798]">Confidence: <strong className="text-[#E2E8F0]">{incident.confidence}%</strong></span>
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-[#E2E8F0]">{incident.title}</h2>
              <p className="text-xs text-[#94A3B8] mt-1 font-sans leading-relaxed">{incident.description}</p>
            </div>

            {incident.aiSummary && (
              <div className="border border-[#3DD9C4]/30 bg-[#3DD9C4]/5 p-3 text-[0.7rem] space-y-1">
                <span className="text-[#3DD9C4] uppercase text-[0.6rem] tracking-wider block font-bold">AI Forensics Synthesis</span>
                <p className="text-[#C1C9D6] font-sans leading-relaxed">{incident.aiSummary}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 text-[0.7rem] border-t border-[#1E293B]/40">
              <div className="flex items-center gap-4 text-[#7C8798]">
                <span>Correlated Findings: <strong className="text-[#E2E8F0]">{incident.findingIds?.length || 0}</strong></span>
                <span>Affected Hosts: <strong className="text-[#E2E8F0]">{incident.hostIds?.length || 0}</strong></span>
                <span>Captures Secured: <strong className="text-[#3DD9C4]">{incident.captureIds?.length || 0}</strong></span>
              </div>

              <Link
                href={`/incidents/${incident.id}`}
                className="px-3 py-1.5 text-[0.65rem] uppercase tracking-wider border border-[#F43F5E]/60 text-[#F43F5E] hover:bg-[#F43F5E]/10 transition-colors font-bold"
              >
                OPEN INCIDENT WORKSPACE →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
