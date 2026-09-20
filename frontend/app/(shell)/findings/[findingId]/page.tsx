'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { getAlertDetail, explainAlert, type CanonicalAlert, type CanonicalFlow } from '@/lib/api';

const SEV: Record<string, string> = {
  critical: 'text-red-400 border-red-500/30 bg-red-500/10',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  low: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  info: 'text-zinc-400 border-white/10 bg-white/5',
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass p-6 space-y-3">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm text-zinc-600">None recorded.</p>;
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-sm text-zinc-300 leading-relaxed">
          <span className="text-zinc-600 shrink-0">—</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export default function FindingDetailPage() {
  const params = useParams();
  const id = String(params.findingId ?? '');
  const [alert, setAlert] = useState<CanonicalAlert | null>(null);
  const [flow, setFlow] = useState<CanonicalFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<Record<string, any> | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    getAlertDetail(id)
      .then((d) => { if (live) { setAlert(d.alert); setFlow(d.flow); } })
      .catch((e) => { if (live) setError(e?.message ?? 'Could not load this finding'); });
    return () => { live = false; };
  }, [id]);

  const explain = () => {
    setAsking(true);
    explainAlert(id).then(setAi).catch(() => {}).finally(() => setAsking(false));
  };

  if (error) {
    return (
      <div className="p-10">
        <div className="glass p-6 text-sm text-amber-300">{error}</div>
      </div>
    );
  }
  if (!alert) return <div className="p-10 text-sm text-zinc-500 font-mono">Loading…</div>;

  const sev = SEV[alert.severity] ?? SEV.info;
  const facts: [string, string | number | undefined][] = flow
    ? [
        ['Source', `${flow.source_ip}${flow.source_port ? ':' + flow.source_port : ''}`],
        ['Destination', `${flow.destination_ip}${flow.destination_port ? ':' + flow.destination_port : ''}`],
        ['Application', flow.application],
        ['Transport', flow.transport],
        ['Packets', flow.packets?.toLocaleString()],
        ['Bytes', flow.bytes?.toLocaleString()],
        ['Duration', flow.duration_seconds ? `${flow.duration_seconds}s` : undefined],
        ['Observed', flow.timestamp],
      ]
    : [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <Link href="/findings" className="inline-flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="w-3.5 h-3.5" /> All findings
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
          <span className="text-[#3DD9C4]">{alert.alert_id}</span>
          <span className={`px-2 py-0.5 rounded border uppercase tracking-wider ${sev}`}>{alert.severity}</span>
          <span className="text-zinc-500">risk {alert.risk_score}</span>
          <span className="text-zinc-500">confidence {alert.confidence}%</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white leading-snug">{alert.title}</h1>
      </header>

      <Panel title="Observed evidence">
        <Bullets items={alert.evidence as string[] | undefined} />
      </Panel>

      {facts.length > 0 && (
        <Panel title="The flow behind it">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {facts.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-wider text-zinc-600">{k}</dt>
                <dd className="font-mono text-sm text-zinc-200 mt-1 break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Panel title="Recommended next steps">
          <Bullets items={alert.recommended_next_steps as string[] | undefined} />
        </Panel>
        <Panel title="Other explanations">
          <Bullets items={alert.alternative_explanations as string[] | undefined} />
        </Panel>
      </div>

      {(alert.missing_evidence as string[] | undefined)?.length ? (
        <Panel title="What would raise confidence">
          <Bullets items={alert.missing_evidence as string[]} />
        </Panel>
      ) : null}

      <Panel title="AI explanation">
        {ai ? (
          <div className="space-y-3 text-sm text-zinc-300 leading-relaxed">
            <p>{String(ai.narrative ?? ai.summary ?? '')}</p>
            {ai.data_notice ? <p className="text-xs text-zinc-600">{String(ai.data_notice)}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            {/* The verdict above is the detection engine's. This only adds prose. */}
            <p className="text-sm text-zinc-500">
              Severity, confidence and evidence above come from the detection engine. Ask the
              model to narrate them.
            </p>
            <button
              onClick={explain}
              disabled={asking}
              className="glass glass-hover inline-flex items-center gap-2 px-4 py-2 text-xs font-mono text-zinc-200 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#3DD9C4]" />
              {asking ? 'Thinking…' : 'Explain this finding'}
            </button>
          </div>
        )}
      </Panel>

      {(alert.rule_ids as string[] | undefined)?.length ? (
        <p className="font-mono text-[11px] text-zinc-600">
          matched: {(alert.rule_ids as string[]).join(' · ')}
        </p>
      ) : null}
    </div>
  );
}
