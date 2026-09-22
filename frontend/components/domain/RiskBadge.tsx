'use client';

import React from 'react';
import { riskColor, riskLabel } from '@/lib/utils';

export function RiskBadge({ score }: { score: number }) {
  const colorClass = riskColor(score);
  const label = riskLabel(score);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass} bg-slate-950/60 border border-current/20`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{score}</span>
      <span className="text-[10px] opacity-75">({label})</span>
    </span>
  );
}
