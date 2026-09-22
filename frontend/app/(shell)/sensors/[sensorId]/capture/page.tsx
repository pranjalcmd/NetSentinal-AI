'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSensorDetail, type BackendSensor } from '@/lib/api';
import { AlertTriangle, CheckCircle2, XCircle, Cpu } from 'lucide-react';

function EngineField({ label, value }: { label: string; value: unknown }) {
  const isBool = typeof value === 'boolean';
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <span className="text-xs text-slate-400 capitalize">{label.replace(/_/g, ' ')}</span>
      {isBool ? (
        <span className={`flex items-center gap-1.5 text-xs font-medium ${value ? 'text-emerald-400' : 'text-slate-500'}`}>
          {value ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {value ? 'Enabled' : 'Disabled'}
        </span>
      ) : (
        <span className="text-xs font-mono text-slate-200">{String(value)}</span>
      )}
    </div>
  );
}

export default function SensorCaptureConfigPage() {
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
        <p className="text-sm text-slate-200 font-medium">Could not load this sensor's capture config.</p>
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

  if (!sensor) return <div className="p-6 text-center text-slate-400">Loading capture engine config...</div>;

  const engine = sensor.capture_engine || {};
  const hasEngine = Object.keys(engine).length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Cpu className="w-5 h-5 text-blue-400" />
        <h1 className="text-xl font-bold text-slate-100">Sensor Capture Engine Config</h1>
      </div>
      <p className="text-xs text-slate-500">
        {sensor.name} ({sensor.id}) — live state reported by /api/sensors/{'{id}'}, read-only.
      </p>

      {hasEngine ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800 max-w-xl">
          {Object.entries(engine).map(([key, value]) => (
            <EngineField key={key} label={key} value={value} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">This sensor reported no capture engine details.</p>
      )}

      <p className="text-xs text-slate-600">
        This backend has no endpoint to change these settings yet — everything above is reported
        status only, not an editable configuration form.
      </p>
    </div>
  );
}