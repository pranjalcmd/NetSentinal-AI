'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSensor } from '@/lib/mock/services';
import type { Sensor } from '@/lib/types';
import { SensorStatus } from '@/components/domain/SensorStatus';
import { Wifi, Activity } from 'lucide-react';

export default function SensorDetailPage() {
  const params = useParams();
  const [sensor, setSensor] = useState<Sensor | null>(null);

  useEffect(() => {
    if (params.sensorId) {
      getSensor(String(params.sensorId)).then(setSensor);
    }
  }, [params.sensorId]);

  if (!sensor) return <div className="p-12 text-center text-slate-400">Loading sensor info...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{sensor.name}</span>
            <SensorStatus status={sensor.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Hostname: {sensor.hostname} • OS: {sensor.os}</p>
        </div>
      </div>
    </div>
  );
}
