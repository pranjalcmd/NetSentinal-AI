'use client';

import React, { useEffect, useState } from 'react';
import { getSystemHealth } from '@/lib/mock/services';
import type { SystemHealth } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

export default function HealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    getSystemHealth().then(setHealth);
  }, []);

  if (!health) {
    return (
      <div className="p-12 text-center font-mono text-xs text-[#7C8798] tracking-widest uppercase">
        LOADING PLATFORM TELEMETRY...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>INFRASTRUCTURE TELEMETRY</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">microservice diagnostics & sensor fleet health</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            System Health & Diagnostic Status
          </h1>
        </div>

        <div className="flex items-center gap-4 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <span className="text-[#7C8798]">STATUS:</span>
          <span className={`font-bold uppercase tracking-wider ${
            health.overall === 'healthy' ? 'text-[#3DD9C4]' : 'text-[#F59E0B]'
          }`}>
            {health.overall}
          </span>
          <span className="text-[#1E293B]">|</span>
          <span className="text-[#7C8798]">PONG: {formatTimestamp(health.timestamp)}</span>
        </div>
      </div>

      {/* HEALTH GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {health.components.map((c, i) => {
          const isHealthy = c.status === 'healthy';
          return (
            <div key={i} className="border border-[#1E293B]/60 bg-[#060910] p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-[#3DD9C4]' : 'bg-[#F59E0B] animate-pulse'}`} />
                  <h3 className="text-xs font-bold text-[#E2E8F0] tracking-wider uppercase">{c.name}</h3>
                </div>
                <p className="text-[0.68rem] text-[#7C8798] mt-1 font-mono">
                  {c.detail || `Latency: ${c.latencyMs || 12}ms`}
                </p>
              </div>

              <span className={`px-2 py-0.5 text-[0.6rem] uppercase tracking-wider font-bold border ${
                isHealthy ? 'border-[#3DD9C4]/40 text-[#3DD9C4] bg-[#3DD9C4]/5' : 'border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/5'
              }`}>
                {c.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
