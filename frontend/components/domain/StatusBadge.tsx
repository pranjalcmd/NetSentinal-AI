'use client';

import React from 'react';

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let color = "bg-slate-800 text-slate-300 border-slate-700";
  if (['open', 'investigating', 'recording', 'active', 'degraded'].includes(s)) {
    color = "bg-amber-950/50 text-amber-400 border-amber-500/30";
  } else if (['critical', 'high', 'failed', 'offline'].includes(s)) {
    color = "bg-red-950/50 text-red-400 border-red-500/30";
  } else if (['resolved', 'ready', 'analyzed', 'verified', 'online', 'completed', 'confirmed'].includes(s)) {
    color = "bg-emerald-950/50 text-emerald-400 border-emerald-500/30";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider ${color}`}>
      {status}
    </span>
  );
}
