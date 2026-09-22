'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSensorDetail, type BackendSensor } from '@/lib/api';
import { SensorStatus } from '@/components/domain/SensorStatus';
import { AlertTriangle, Wifi, Activity } from 'lucide-react';

export default function SensorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [sensor, setSensor] = useState<BackendSensor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.sensorId) return;
    const id = String(params.sensorId);
    setSensor(null);
    setError(null);

    getSensorDetail(id)
      .then(setSensor)
      .catch((err) => setError(err instanceof Error ? err.message : `Sensor ${id} could not be loaded`));
  }, [params.sensorId]);

  if (error) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <p className="text-sm text-slate-200 font-medium">This sensor could not be found.</p>
        <p className="text-xs text-slate-500">{error}</p>
        <button
          onClick={() => router.push('/sensors')}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs font-medium text-slate-300 transition-colors"
        >
          Back to sensors
        </button>
      </div>
    );
  }

  if (!sensor) return <div className="p-12 text-center text-slate-400">Loading sensor info...</div>;

  const engine = sensor.capture_engine || {};
  const metrics = sensor.metrics || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{sensor.name}</span>
            <SensorStatus status={sensor.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Hostname: {sensor.hostname} • OS: {sensor.os} • v{sensor.version}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Wifi className="w-3.5 h-3.5" />
          {sensor.interface}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</p>
            <p className="text-lg font-bold font-mono text-slate-100">{String(value)}</p>
          </div>
        ))}
      </div>

      {Object.keys(engine).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-100">Capture Engine</span>
          </div>
          <div className="divide-y divide-slate-800">
            {Object.entries(engine).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-xs text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-xs font-mono text-slate-200">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}