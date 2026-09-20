'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown, Music, Play, Pause, Radio, ShieldCheck } from 'lucide-react';

export function BottomTelemetryBar() {
  const [isPlaying, setIsPlaying] = useState(true);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* Persistent Bottom Bar matching Árstraumur design */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#04060a]/95 backdrop-blur-md border-t border-slate-800/80 px-8 py-3 flex items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>© 2022–2026 · Árstraumur · Built by</span>
          <Link href="/overview" className="text-blue-400 hover:text-blue-300 font-sans font-semibold text-xs flex items-center gap-1.5 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
            <ShieldCheck className="w-3.5 h-3.5" /> NetSentinal SOC Console »
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* Audio Player Ticker */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-3 px-3.5 py-1.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/60 rounded text-slate-200 hover:text-white transition-colors cursor-pointer shadow-lg"
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying(!isPlaying);
              }}
              className="text-blue-400 hover:text-blue-300 font-bold"
            >
              {isPlaying ? '❚❚' : '▶'}
            </span>

            {/* Equalizer animation */}
            <div className="flex items-end gap-0.5 h-3">
              <span className={`w-0.5 bg-blue-400 ${isPlaying ? 'animate-bounce' : 'h-1.5'}`} style={{ animationDuration: '0.6s' }} />
              <span className={`w-0.5 bg-blue-400 ${isPlaying ? 'animate-bounce' : 'h-2.5'}`} style={{ animationDuration: '0.4s' }} />
              <span className={`w-0.5 bg-blue-400 ${isPlaying ? 'animate-bounce' : 'h-1'}`} style={{ animationDuration: '0.8s' }} />
              <span className={`w-0.5 bg-blue-400 ${isPlaying ? 'animate-bounce' : 'h-2'}`} style={{ animationDuration: '0.5s' }} />
            </div>

            <span className="font-semibold text-xs tracking-wider uppercase">
              AURORA III (FEAT. VINCE CLARKE)
            </span>

            {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </div>
      </footer>

      {/* Expanded Audio / Telemetry Player Drawer */}
      {expanded && (
        <div className="fixed bottom-14 right-8 z-50 w-96 p-5 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-lg space-y-4 animate-slide-in-right">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-100">
              <Music className="w-4 h-4 text-blue-400" /> Now Playing: Aurora III
            </div>
            <button onClick={() => setExpanded(false)} className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Track:</span>
              <span className="font-mono text-slate-200 font-bold">Aurora III (feat. Vince Clarke)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Album:</span>
              <span className="font-mono text-slate-200">Aurora (2025 Release)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Status:</span>
              <span className="font-mono text-emerald-400 font-bold">STREAMING · 320 KBPS</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>SOC Correlation:</span>
              <span className="font-mono text-blue-400 font-bold">CAP-1050 / TRG-883 LINKED</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-between gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              {isPlaying ? <><Pause className="w-3.5 h-3.5" /> Pause Audio</> : <><Play className="w-3.5 h-3.5" /> Play Track</>}
            </button>
            <Link
              href="/incidents/INC-2026-041"
              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-semibold transition-colors text-center"
            >
              View Analysis »
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
