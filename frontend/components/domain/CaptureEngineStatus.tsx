'use client';

import React from 'react';
import type { CaptureEngineStatus as EngineStatusType } from '@/lib/types';
import { Activity, ShieldCheck, RefreshCw } from 'lucide-react';

export function CaptureEngineStatus({ status }: { status: EngineStatusType }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs">
      <div className="flex items-center gap-1.5 text-slate-300">
        <Activity className="w-4 h-4 text-blue-400" />
        <span>Rolling: <strong className={status.rollingCapture ? "text-emerald-400" : "text-slate-500"}>{status.rollingCapture ? "ACTIVE (600s)" : "OFFLINE"}</strong></span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-300">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Auto-Preserve: <strong className={status.autoPreservation ? "text-emerald-400" : "text-slate-500"}>{status.autoPreservation ? "ENABLED" : "DISABLED"}</strong></span>
      </div>
      {status.manualCapture && (
        <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
          <RefreshCw className="w-4 h-4 spin" />
          <span>Manual Capture In Progress</span>
        </div>
      )}
    </div>
  );
}
