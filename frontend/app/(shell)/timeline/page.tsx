'use client';

import React, { useEffect, useState } from 'react';
import { getTimeline } from '@/lib/mock/services';
import type { TimelineEvent } from '@/lib/types';
import { formatTimestamp } from '@/lib/utils';

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    getTimeline().then(setEvents);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 font-mono text-[#C1C9D6]">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#1E293B]/60 pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2 text-[0.65rem] tracking-[0.2em] uppercase text-[#7C8798]">
            <span>CHRONOLOGY LAYER</span>
            <span className="text-[#3DD9C4]/40">·</span>
            <span className="text-[#3DD9C4] lowercase font-sans">unified event sequence across sensors, captures & triggers</span>
          </div>
          <h1 className="text-lg tracking-widest text-[#E2E8F0] uppercase mt-1 font-semibold">
            Master Telemetry Timeline
          </h1>
        </div>

        <div className="flex items-center gap-4 text-[0.7rem] border border-[#1E293B]/80 px-4 py-2 bg-[#090d16]">
          <span className="text-[#7C8798]">EVENT STREAM:</span>
          <span className="text-[#3DD9C4] font-bold">{events.length} RECORDED EVENTS</span>
        </div>
      </div>

      {/* TIMELINE LIST */}
      <div className="border border-[#1E293B]/60 bg-[#060910] p-6 space-y-6">
        <div className="flex items-center justify-between text-[0.65rem] uppercase tracking-widest text-[#7C8798] border-b border-[#1E293B]/60 pb-2">
          <span>EVENT CHRONOLOGY INDEX</span>
          <span>REAL-TIME STREAMING LOG</span>
        </div>

        <div className="space-y-4 relative pl-6 border-l border-[#1E293B]/80">
          {events.map((e) => {
            const isCritical = e.severity === 'critical';
            return (
              <div key={e.id} className="relative group">
                <div className={`absolute -left-[31px] top-1 w-2.5 h-2.5 border ${
                  isCritical ? 'bg-[#F43F5E] border-[#F43F5E]' :
                  e.severity === 'high' ? 'bg-[#F59E0B] border-[#F59E0B]' :
                  'bg-[#3DD9C4] border-[#3DD9C4]'
                }`} />

                <div className="border border-[#1E293B]/60 bg-[#090d16] p-3 space-y-1.5 hover:border-[#3DD9C4]/40 transition-colors">
                  <div className="flex items-center justify-between text-[0.7rem]">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.2 text-[0.6rem] uppercase tracking-wider border ${
                        isCritical ? 'border-[#F43F5E]/40 text-[#F43F5E]' :
                        e.severity === 'high' ? 'border-[#F59E0B]/40 text-[#F59E0B]' :
                        'border-[#3DD9C4]/40 text-[#3DD9C4]'
                      }`}>
                        {e.type}
                      </span>
                      <span className="font-bold text-[#E2E8F0]">{e.title}</span>
                    </div>
                    <span className="text-[#7C8798] text-[0.65rem]">{e.timestamp ? formatTimestamp(e.timestamp) : '—'}</span>
                  </div>

                  <p className="text-xs text-[#94A3B8] font-sans leading-relaxed">{e.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
