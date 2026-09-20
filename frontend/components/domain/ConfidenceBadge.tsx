'use client';

import React from 'react';

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  let color = "text-emerald-400 bg-emerald-950/40 border-emerald-500/30";
  if (confidence < 70) color = "text-amber-400 bg-amber-950/40 border-amber-500/30";
  if (confidence < 50) color = "text-slate-400 bg-slate-900 border-slate-700";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium border ${color}`}>
      <span>Conf:</span>
      <span>{confidence}%</span>
    </span>
  );
}
