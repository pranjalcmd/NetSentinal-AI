'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getInvestigation } from '@/lib/mock/services';
import type { Investigation } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Search, CheckCircle, ShieldAlert, Cpu } from 'lucide-react';

export default function InvestigationDetailPage() {
  const params = useParams();
  const [inv, setInv] = useState<Investigation | null>(null);

  useEffect(() => {
    if (params.id) {
      getInvestigation(String(params.id)).then(setInv);
    }
  }, [params.id]);

  if (!inv) return <div className="p-12 text-center text-slate-400">Loading investigation...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-base font-bold text-slate-100">{inv.id}</span>
            <StatusBadge status={inv.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">Target Capture: {inv.captureId} • Profile: {inv.profile}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs text-slate-500">Flows Processed</p>
          <p className="text-lg font-bold font-mono text-slate-100">{inv.progress.flowsProcessed.toLocaleString()}</p>
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
    </div>
  );
}
