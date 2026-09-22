'use client';

import React, { useEffect, useState } from 'react';
import { getTriggers } from '@/lib/mock/services';
import type { Trigger } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { ShieldAlert, Info } from 'lucide-react';

export default function SensorTriggersPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTriggers()
      .then(setTriggers)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-amber-400" />
        <h1 className="text-xl font-bold text-slate-100">Sensor Preservation Triggers</h1>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-950/30 border border-blue-500/20 rounded-lg text-xs text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          This backend doesn't have a preservation-trigger pipeline yet, so this list is demo data,
          not live per-sensor state — and since there's only one processing pipeline in this
          deployment, there's no per-sensor filtering to apply either.
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Loading triggers...</p>
      ) : triggers.length === 0 ? (
        <p className="text-xs text-slate-500">No triggers to show.</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
          {triggers.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm text-slate-200 font-mono">{t.id}</p>
                <p className="text-xs text-slate-500">
                  {t.entityType} {t.entityId} · score {t.score}
                  {t.preservationReason ? ` · ${t.preservationReason}` : ''}
                </p>
              </div>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}