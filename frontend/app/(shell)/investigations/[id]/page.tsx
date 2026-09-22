'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInvestigation, getFindings, getIncidents } from '@/lib/mock/services';
import type { Investigation, Finding, Incident } from '@/lib/types';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Search, CheckCircle, ShieldAlert, Cpu } from 'lucide-react';

export default function InvestigationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [inv, setInv] = useState<Investigation | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    const id = String(params.id);

    getInvestigation(id)
      .then((data) => {
        setInv(data);
        // Findings/incidents are id lists on the investigation — pull the
        // full lists once and filter locally rather than firing one request
        // per id.
        return Promise.all([getFindings(), getIncidents()]).then(([allFindings, allIncidents]) => {
          setFindings(allFindings.filter((f) => data.findings.includes(f.id)));
          setIncidents(allIncidents.filter((i) => data.incidents.includes(i.id)));
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this investigation'));
  }, [params.id]);

  if (error) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

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
        <button
          onClick={() => router.push(`/investigations/${inv.id}/progress`)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs font-medium text-slate-300 transition-colors"
        >
          <Cpu className="w-3.5 h-3.5" />
          View pipeline
        </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-100">Findings</span>
            <span className="text-xs text-slate-500">({findings.length})</span>
          </div>
          {findings.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-500 text-center">No findings on this investigation.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {findings.map((f) => (
                <button
                  key={f.id}
                  onClick={() => router.push(`/findings/${f.id}`)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-800/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{f.title}</p>
                    <p className="text-xs text-slate-500 font-mono">{f.id} · {f.category}</p>
                  </div>
                  <StatusBadge status={f.severity} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800">
            <Search className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-100">Incidents</span>
            <span className="text-xs text-slate-500">({incidents.length})</span>
          </div>
          {incidents.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-500 text-center">No correlated incidents yet.</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {incidents.map((i) => (
                <button
                  key={i.id}
                  onClick={() => router.push(`/incidents/${i.id}`)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-800/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{i.title}</p>
                    <p className="text-xs text-slate-500 font-mono">{i.id} · Risk {i.riskScore}</p>
                  </div>
                  <StatusBadge status={i.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {inv.status === 'completed' && findings.length === 0 && incidents.length === 0 && (
        <div className="flex items-center gap-2 p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          Analysis complete — no suspicious behaviour was flagged in this capture.
        </div>
      )}
    </div>
  );
}