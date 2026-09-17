'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getIncidents, getFindings, getSystemHealth } from '@/lib/mock/services';
import type { Incident, Finding, SystemHealth } from '@/lib/types';

// Everything on this page comes from the analysis backend. When the backend
// has no analysed capture yet, the sections show professional empty states —
// no invented numbers.

const C = {
  bg:       '#0A0E14',
  surface:  '#0d1117',
  border:   '#1E293B',
  text:     '#E4E8EE',
  muted:    '#8b98ab',
  dim:      '#5a6779',
  teal:     '#3DD9C4',
  critical: '#E8483A',
  high:     '#E8863A',
  medium:   '#E8C93A',
  low:      '#4B7BE5',
};

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#1E293B] px-8 py-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[0.95rem] font-medium text-[#E4E8EE] m-0">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SevBadge({ sev }: { sev: string }) {
  const map: Record<string, [string, string]> = {
    critical: [C.critical, 'rgba(232,72,58,0.12)'],
    high:     [C.high,     'rgba(232,134,58,0.12)'],
    medium:   [C.medium,   'rgba(232,201,58,0.12)'],
    low:      [C.low,      'rgba(75,123,229,0.12)'],
    info:     [C.muted,    'rgba(139,152,171,0.1)'],
  };
  const [color, bg] = map[sev] ?? map.info;
  return (
    <span style={{
      ...MONO, fontSize: '0.62rem', color, background: bg,
      border: `1px solid ${color}33`, padding: '1px 6px',
    }}>{sev.toUpperCase()}</span>
  );
}

const TH: React.CSSProperties = {
  ...MONO, fontSize: '0.62rem', color: C.dim, letterSpacing: '0.06em',
  textTransform: 'uppercase', padding: '0.5rem 0.75rem', textAlign: 'left',
  borderBottom: `1px solid ${C.border}`, fontWeight: 500,
};
const TD: React.CSSProperties = {
  ...MONO, fontSize: '0.75rem', color: C.muted, padding: '0.55rem 0.75rem',
  borderBottom: '1px solid #151c28',
};

function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-[#8b98ab] m-0">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const LinkBtn = ({ href, children, primary = false }: { href: string; children: React.ReactNode; primary?: boolean }) => (
  <Link
    href={href}
    className="no-underline text-[0.78rem] px-3.5 py-1.5 border transition-colors duration-150"
    style={{
      color: primary ? C.teal : C.muted,
      borderColor: primary ? `${C.teal}55` : C.border,
      background: primary ? `${C.teal}0d` : 'transparent',
    }}
  >
    {children}
  </Link>
);

export default function OverviewPage() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    getIncidents({ limit: 8 }).then(setIncidents).catch(() => setIncidents([]));
    getFindings({ limit: 8 }).then(setFindings).catch(() => setFindings([]));
    getSystemHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const loading = incidents === null || findings === null;

  return (
    <div style={{ background: C.bg, minHeight: '100%', color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Network Overview header */}
      <section className="px-8 pt-8 pb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold m-0 text-[#E4E8EE]">Network Overview</h1>
            <p className="text-[0.8rem] text-[#8b98ab] mt-1 mb-0">
              Review analysed traffic, security findings, and incident correlations.
            </p>
          </div>
          <div className="flex gap-2">
            <LinkBtn href="/investigations/new/upload" primary>Upload PCAP</LinkBtn>
            <LinkBtn href="/findings">View Findings</LinkBtn>
          </div>
        </div>

        {/* Metric strip — only backend-reported values */}
        <div className="grid grid-cols-4 border border-[#1E293B] mt-5 bg-[#0d1117]">
          {[
            { label: 'Findings', value: findings?.length, hint: 'signals detected' },
            { label: 'Incidents', value: incidents?.length, hint: 'correlated groups' },
            { label: 'System Status', value: health ? health.overall : null, hint: 'engine health' },
            { label: 'Components', value: health ? `${health.components.length}` : null, hint: 'monitored' },
          ].map((m) => (
            <div key={m.label} className="px-5 py-4 border-r border-[#1E293B] last:border-r-0">
              <span style={{ ...MONO }} className="block text-lg text-[#E4E8EE] mb-0.5">
                {loading ? '…' : (m.value ?? '—')}
              </span>
              <span className="block text-[0.65rem] uppercase tracking-wider text-[#5a6779]">{m.label}</span>
              {m.hint && <span className="block text-[0.65rem] text-[#4a5568] mt-1">{m.hint}</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Findings */}
      <Section
        title="Findings"
        action={findings?.length ? <Link className="text-[0.75rem] text-[#3DD9C4] no-underline" href="/findings">All findings →</Link> : undefined}
      >
        {loading ? (
          <p className="text-sm text-[#5a6779]">Loading findings…</p>
        ) : findings && findings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th style={TH}>Finding</th>
                  <th style={TH}>Severity</th>
                  <th style={TH}>Category</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id}>
                    <td style={TD}>
                      <Link href={`/findings/${f.id}`} className="text-[#E4E8EE] no-underline hover:text-[#3DD9C4]">
                        {f.title}
                      </Link>
                    </td>
                    <td style={TD}><SevBadge sev={f.severity} /></td>
                    <td style={TD}>{f.category.replace(/_/g, ' ')}</td>
                    <td style={{ ...TD, textAlign: 'right', color: C.text }}>{f.riskScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            message="No findings yet. Upload a PCAP file to analyse traffic and generate findings."
            action={<LinkBtn href="/investigations/new/upload" primary>Upload PCAP</LinkBtn>}
          />
        )}
      </Section>

      {/* Incidents */}
      <Section
        title="Incidents"
        action={incidents?.length ? <Link className="text-[0.75rem] text-[#3DD9C4] no-underline" href="/incidents">All incidents →</Link> : undefined}
      >
        {loading ? (
          <p className="text-sm text-[#5a6779]">Loading incidents…</p>
        ) : incidents && incidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th style={TH}>Incident</th>
                  <th style={TH}>Severity</th>
                  <th style={TH}>Status</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td style={TD}>
                      <Link href={`/incidents/${i.id}`} className="text-[#E4E8EE] no-underline hover:text-[#3DD9C4]">
                        {i.title}
                      </Link>
                    </td>
                    <td style={TD}><SevBadge sev={i.riskScore >= 80 ? 'critical' : i.riskScore >= 60 ? 'high' : i.riskScore >= 40 ? 'medium' : 'low'} /></td>
                    <td style={TD}>{i.status}</td>
                    <td style={{ ...TD, textAlign: 'right', color: C.text }}>{i.riskScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No incidents correlated yet. Incidents appear when multiple findings share a root cause." />
        )}
      </Section>
    </div>
  );
}
