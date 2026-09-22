'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInvestigation } from '@/lib/mock/services';
import type { Investigation } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { CheckCircle2, Loader2, XCircle, Circle } from 'lucide-react';

function StageIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
  if (status === 'failed') return <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  if (status === 'running') return <Loader2 className="w-4 h-4 text-blue-400 flex-shrink-0 animate-spin" />;
  return <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />;
}

export default function InvestigationProgressPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [inv, setInv] = useState<Investigation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const load = async () => {
      try {
        const data = await getInvestigation(id);
        if (cancelled) return;
        setInv(data);
        setError(null);

        // Still running — poll again shortly instead of leaving a stale view.
        if (data.status === 'running' || data.status === 'queued') {
          interval = setTimeout(load, 2000);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this investigation');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (interval) clearTimeout(interval);
    };
  }, [id]);

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold text-slate-100">Live Investigation Pipeline</h1>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold text-slate-100">Live Investigation Pipeline</h1>
        <p className="text-xs text-slate-400">12-Stage Deep Forensic Processing Pipeline</p>
        <div className="flex items-center gap-2 text-sm text-slate-400 pt-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading investigation…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-100">Live Investigation Pipeline</h1>
        <p className="text-xs text-slate-400">12-Stage Deep Forensic Processing Pipeline</p>
      </div>

      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{inv.id}</span>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Target Capture: {inv.captureId} · Profile: {inv.profile}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Flows Processed</p>
          <p className="text-lg font-bold font-mono text-slate-100">
            {inv.progress.flowsProcessed.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Hosts Identified</p>
          <p className="text-lg font-bold font-mono text-slate-100">{inv.progress.hostsIdentified}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Findings Generated</p>
          <p className="text-lg font-bold font-mono text-amber-400">{inv.progress.findingsSoFar}</p>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Protocols Discovered</p>
          <p className="text-lg font-bold font-mono text-emerald-400">{inv.progress.protocolsFound}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
        {inv.stages.map((stage, idx) => (
          <div key={idx} className="flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-3">
              <StageIcon status={stage.status} />
              <span className="text-sm text-slate-200">{stage.name}</span>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {stage.itemsTotal ? `${stage.itemsProcessed?.toLocaleString()} / ${stage.itemsTotal.toLocaleString()}` : stage.status}
            </span>
          </div>
        ))}
      </div>

      {inv.status === 'completed' && (
        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/investigations/${inv.id}`)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            View full investigation
          </button>
        </div>
      )}
    </div>
  );
}