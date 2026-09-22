'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFindingDetail, type BackendFinding } from '@/lib/api';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { ConfidenceBadge } from '@/components/domain/ConfidenceBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { AlertTriangle, Bot } from 'lucide-react';

export default function FindingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [finding, setFinding] = useState<BackendFinding | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.findingId) return;
    const id = String(params.findingId);
    setFinding(null);
    setError(null);

    getFindingDetail(id)
      .then(setFinding)
      .catch((err) => {
        setError(err instanceof Error ? err.message : `Finding ${id} could not be loaded`);
      });
  }, [params.findingId]);

  if (error) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <div className="space-y-1">
          <p className="text-sm text-slate-200 font-medium">This finding is no longer available.</p>
          <p className="text-xs text-slate-500">
            {error}. Findings aren't kept once a newer capture has been analyzed — the backend
            works from a single current dataset rather than storing history per investigation.
          </p>
        </div>
        <button
          onClick={() => router.push('/findings')}
          className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs font-medium text-slate-300 transition-colors"
        >
          Back to findings
        </button>
      </div>
    );
  }

  if (!finding) return <div className="p-12 text-center text-slate-400">Loading finding details...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-400">{finding.id}</span>
            <RiskBadge score={finding.risk_score} />
            <ConfidenceBadge confidence={finding.confidence} />
            <StatusBadge status={finding.status} />
          </div>
          <h1 className="text-xl font-bold text-slate-100">{finding.title}</h1>
          <p className="text-xs text-slate-500">
            {finding.category} · Capture {finding.capture_id} · Sensor {finding.sensor_id}
          </p>
        </div>
      </div>

      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Description</h4>
        <p className="text-sm text-slate-200 leading-relaxed">{finding.description}</p>
      </div>

      {(finding.source_ip || finding.destination_ip) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500">Source IP</p>
            <p className="text-sm font-mono text-slate-200">{finding.source_ip || '—'}</p>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-500">Destination IP</p>
            <p className="text-sm font-mono text-slate-200">{finding.destination_ip || '—'}</p>
          </div>
        </div>
      )}

      {/* AI Analysis Box — only populated once /api/alerts/{id}/explain has been called */}
      {finding.ai_explanation && (
        <div className="p-6 bg-slate-900 border border-blue-900/40 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Bot className="w-5 h-5" /> AI Technical Synthesis
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{finding.ai_explanation.summary}</p>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Why It Was Flagged</h4>
            <p className="text-xs text-slate-300">{finding.ai_explanation.why_flagged}</p>
          </div>

          {Array.isArray(finding.ai_explanation.recommendations) && finding.ai_explanation.recommendations.length > 0 && (
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Recommended Next Steps</h4>
              <ul className="list-disc list-inside space-y-1">
                {finding.ai_explanation.recommendations.map((step: string, idx: number) => (
                  <li key={idx} className="text-xs text-slate-300">{step}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}