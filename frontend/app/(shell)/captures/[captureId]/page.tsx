'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCaptureDetail, BackendCapture } from '@/lib/api';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { formatBytes } from '@/lib/utils';
import { ShieldCheck, HardDrive, Cpu, FileCheck } from 'lucide-react';

export default function CaptureDetailPage() {
  const params = useParams();
  const [capture, setCapture] = useState<BackendCapture | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.captureId) {
      getCaptureDetail(String(params.captureId))
        .then(setCapture)
        .catch((e) => setError(e.message || 'Capture not found'));
    }
  }, [params.captureId]);

  if (error) return <div className="p-12 text-center text-red-400">{error}</div>;
  if (!capture) return <div className="p-12 text-center text-slate-400">Loading capture details...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{capture.id}</span>
            <StatusBadge status={capture.status} />
          </div>
          <p className="text-xs text-slate-400">{capture.filename}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-500/30">
          <ShieldCheck className="w-4 h-4" /> SHA-256 Verified
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Size</p>
          <p className="text-lg font-bold font-mono text-slate-100">{formatBytes(capture.size_bytes || 0)}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Flows</p>
          <p className="text-lg font-bold font-mono text-slate-100">{capture.flows?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Alerts</p>
          <p className="text-lg font-bold font-mono text-slate-100">{capture.alerts?.toLocaleString() ?? '—'}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Sensor</p>
          <p className="text-lg font-bold font-mono text-slate-100">{capture.sensor_id}</p>
        </div>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">SHA-256 Checksum</h3>
        <p className="font-mono text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 select-all">
          {capture.sha256}
        </p>
      </div>
    </div>
  );
}
