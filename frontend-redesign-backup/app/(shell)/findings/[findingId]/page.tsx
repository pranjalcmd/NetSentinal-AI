'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFinding } from '@/lib/mock/services';
import type { Finding } from '@/lib/types';
import { RiskBadge } from '@/components/domain/RiskBadge';
import { ConfidenceBadge } from '@/components/domain/ConfidenceBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { AlertTriangle, Bot, CheckCircle } from 'lucide-react';

export default function FindingDetailPage() {
  const params = useParams();
  const [finding, setFinding] = useState<Finding | null>(null);

  useEffect(() => {
    if (params.findingId) {
      getFinding(String(params.findingId)).then(setFinding);
    }
  }, [params.findingId]);

  if (!finding) return <div className="p-12 text-center text-slate-400">Loading finding details...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-5 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-400">{finding.id}</span>
            <RiskBadge score={finding.riskScore} />
            <ConfidenceBadge confidence={finding.confidence} />
            <StatusBadge status={finding.status} />
          </div>
          <h1 className="text-xl font-bold text-slate-100">{finding.title}</h1>
        </div>
      </div>

      {/* AI Analysis Box */}
      {finding.aiAnalysis && (
        <div className="p-6 bg-slate-900 border border-blue-900/40 rounded-xl space-y-4">
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
            <Bot className="w-5 h-5" /> AI Technical Synthesis
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">{finding.aiAnalysis.summary}</p>
          
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase">Why It Matters</h4>
            <p className="text-xs text-slate-300">{finding.aiAnalysis.whyItMatters}</p>
          </div>
        </div>
      )}
    </div>
  );
}
