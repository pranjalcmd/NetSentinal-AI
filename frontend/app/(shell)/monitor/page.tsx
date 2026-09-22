'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Play, ShieldAlert, Cpu } from 'lucide-react';
import { getSensors } from '@/lib/mock/services';
import type { Sensor } from '@/lib/types';
import { SensorStatus } from '@/components/domain/SensorStatus';
import { formatBytes } from '@/lib/utils';

export default function MonitorPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);

  useEffect(() => {
    getSensors().then(setSensors);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Live Network Monitoring Console</h1>
          <p className="text-xs text-slate-400">Real-time authorized network capture and sensor telemetry</p>
        </div>
        <Link href="/monitor/capture" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors">
          <Play className="w-4 h-4" /> Open Manual Capture Console
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sensors.map(s => (
          <div key={s.id} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold text-slate-100">{s.name}</span>
              <SensorStatus status={s.status} />
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              <p>Interface: <span className="font-mono text-slate-200">{s.interface}</span></p>
              <p>OS: <span className="text-slate-200">{s.os}</span></p>
              <p>Version: <span className="font-mono text-slate-200">{s.version}</span></p>
            </div>
            <div className="pt-3 border-t border-slate-800 grid grid-cols-3 text-center">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Mbps</p>
                <p className="text-sm font-bold font-mono text-slate-200">{s.metrics.mbps}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">PPS</p>
                <p className="text-sm font-bold font-mono text-slate-200">{s.metrics.pps}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Buffer</p>
                <p className="text-sm font-bold font-mono text-emerald-400">{s.metrics.bufferPercent}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
