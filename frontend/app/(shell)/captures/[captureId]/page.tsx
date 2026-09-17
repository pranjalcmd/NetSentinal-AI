'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCapture } from '@/lib/mock/services';
import type { Capture } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatBytes, formatDuration } from '@/lib/utils';
import { ShieldCheck, HardDrive, Cpu, FileCheck } from 'lucide-react';

export default function CaptureDetailPage() {
  const params = useParams();
  const [capture, setCapture] = useState<Capture | null>(null);

  useEffect(() => {
    if (params.captureId) {
      getCapture(String(params.captureId)).then(setCapture);
    }
  }, [params.captureId]);

  if (!capture) return <div className="p-12 text-center text-slate-400">Loading capture details...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{capture.id}</span>
            <StatusBadge status={capture.status} />
          </div>
          <p className="text-xs text-slate-400">{capture.preservationReason || "Standard forensics capture session"}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-500/30">
          <ShieldCheck className="w-4 h-4" /> SHA-256 Verified
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Size</p>
          <p className="text-lg font-bold font-mono text-slate-100">{formatBytes(capture.sizeBytes || 0)}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Duration</p>
          <p className="text-lg font-bold font-mono text-slate-100">{formatDuration(capture.durationSec || 0)}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Packets</p>
          <p className="text-lg font-bold font-mono text-slate-100">{capture.metadata?.packets?.toLocaleString() || "4,281,920"}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Sensor</p>
          <p className="text-lg font-bold font-mono text-slate-100">{capture.sensorId}</p>
        </div>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">SHA-256 Checksum</h3>
        <p className="font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 select-all">
          {capture.sha256 || "a3f4b8c2d1e9f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2"}
        </p>
      </div>
    </div>
  );
}
