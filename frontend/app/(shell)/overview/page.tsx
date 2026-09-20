'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { api, apiBaseUrl, type Alert, type Entity, type Incident } from '@/lib/api';
import { useApi, useNow } from '@/lib/useApi';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       '#04060c',
  surface:  '#06090f',
  border:   '#1A2230',
  border2:  '#0f1620',
  text:     '#E4E8EE',
  muted:    '#515E72',
  dim:      '#3a4455',
  teal:     '#3DD9C4',
  critical: '#E8483A',
  high:     '#E8863A',
  medium:   '#E8C93A',
  low:      '#4B7BE5',
};

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };
const SANS: React.CSSProperties = { fontFamily: "'Inter', system-ui, sans-serif" };

/** Analysis older than this is reported as stale, never as live (PRD §7). */
const FRESH_FOR_MS = 5 * 60 * 1000;

const SEV_COLOR: Record<string, string> = {
  CRITICAL: C.critical, HIGH: C.high, MEDIUM: C.medium, LOW: C.low, INFO: C.muted,
};

// ─── Shared style helpers ─────────────────────────────────────────────────────
function Label({ text }: { text: string }) {
  return (
    <p style={{
      display: 'flex', alignItems: 'center',
      ...MONO, fontSize: '0.62rem', color: C.dim,
      letterSpacing: '0.06em', margin: '0 0 0.55rem',
    }}>
      {text}
      <span style={{ flex: 1, height: 1, background: C.border2, marginLeft: '0.75rem' }} />
    </p>
  );
}

function SevBadge({ sev }: { sev: string }) {
  const color = SEV_COLOR[sev] ?? C.muted;
  return (
    <span style={{
      ...MONO, fontSize: '0.52rem', fontWeight: 700,
      letterSpacing: '0.08em', color,
      border: `1px solid ${color}55`, background: `${color}10`,
      padding: '1px 5px',
    }}>{sev}</span>
  );
}

const TH: React.CSSProperties = {
  ...MONO, fontSize: '0.55rem', color: C.dim,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  padding: '0.5rem 0.85rem',
  borderBottom: `1px solid ${C.border}`,
  fontWeight: 400, textAlign: 'left',
  background: C.bg,
};
const TD: React.CSSProperties = {
  ...MONO, fontSize: '0.68rem', color: C.muted,
  padding: '0.55rem 0.85rem',
  borderBottom: `1px solid ${C.border2}`,
  verticalAlign: 'middle',
};
const TDA: React.CSSProperties = { ...TD, color: C.teal };
const TDP: React.CSSProperties = { ...TD, color: C.text };

function Band({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{ padding: '2rem 2.5rem', borderTop: first ? 'none' : `1px solid ${C.border}` }}>
      {children}
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      ...SANS, fontSize: '1.05rem', fontWeight: 400,
      color: C.text, letterSpacing: '-0.02em',
      margin: '0.2rem 0 1rem', lineHeight: 1.2,
    }}>{children}</h2>
  );
}

function GhostLink({ href, children, accent = false }: { href: string; children: React.ReactNode; accent?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <Link href={href} style={{
      ...MONO, fontSize: '0.6rem',
      color: accent ? C.teal : (hov ? C.text : C.muted),
      border: `1px solid ${accent ? 'rgba(61,217,196,0.35)' : (hov ? C.muted : C.border)}`,
      background: accent ? 'rgba(61,217,196,0.04)' : 'transparent',
      padding: '3px 9px', textDecoration: 'none',
      letterSpacing: '0.04em', transition: 'color 0.12s, border-color 0.12s',
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >{children}</Link>
  );
}

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <Link href={href} style={{
      ...MONO, fontSize: '0.6rem', color: hov ? C.text : C.dim,
      textDecoration: 'none', letterSpacing: '0.04em', transition: 'color 0.12s',
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >{children}</Link>
  );
}

function Button({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} style={{
      ...MONO, fontSize: '0.6rem', cursor: 'pointer',
      color: hov ? C.text : C.muted,
      border: `1px solid ${hov ? C.muted : C.border}`,
      background: 'transparent', padding: '3px 9px', letterSpacing: '0.04em',
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >{children}</button>
  );
}

// ─── State surfaces ───────────────────────────────────────────────────────────

function Note({ children, color = C.muted }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      ...MONO, fontSize: '0.68rem', color,
      border: `1px solid ${C.border}`, background: C.surface,
      padding: '1rem 1.25rem', lineHeight: 1.7,
    }}>{children}</div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          height: '1.6rem', marginBottom: 6,
          background: `linear-gradient(90deg, ${C.border2}, ${C.border}, ${C.border2})`,
          opacity: 0.5,
        }} />
      ))}
    </div>
  );
}

/**
 * Failure gets the cause and a way back, never a silent zero (PRD §7).
 * `compact` drops the recovery hint for sections below the first one, so a
 * backend outage reads as one instruction rather than five copies of it.
 */
function Failure({ error, onRetry, compact = false }: {
  error: { message: string; offline: boolean };
  onRetry: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Note>
        <span style={{ color: C.high }}>Unavailable</span> — {error.message}{' '}
        <button onClick={onRetry} style={{
          ...MONO, fontSize: '0.68rem', color: C.teal, background: 'none',
          border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline',
        }}>retry</button>
      </Note>
    );
  }
  return (
    <Note color={C.high}>
      <div style={{ color: C.critical, marginBottom: '0.4rem' }}>
        {error.offline ? 'Backend unreachable' : 'Request failed'}
      </div>
      <div style={{ color: C.muted, marginBottom: '0.8rem' }}>{error.message}</div>
      {error.offline && (
        <div style={{ color: C.dim, fontSize: '0.62rem', marginBottom: '0.8rem' }}>
          Expected the API at {apiBaseUrl}. Start it with:
          {' '}<span style={{ color: C.teal }}>uvicorn backend.app.main:app --port 8000</span>
        </div>
      )}
      <Button onClick={onRetry}>Retry</Button>
    </Note>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const dashboard = useApi(() => api.dashboard());
  const entities  = useApi(() => api.entities());
  const jobs      = useApi(() => api.jobs());
  const health    = useApi(() => api.health());

  const reloadAll = () => {
    // A capture change invalidates every dependent view, so they refresh
    // together rather than showing a mix of two captures (PRD §7).
    dashboard.reload(); entities.reload(); jobs.reload(); health.reload();
  };

  // Ticks on its own so the badge ages into STALE without a reload.
  const now = useNow();

  const summary   = dashboard.data;
  const lastJob   = jobs.data?.[0];
  const analysedAt = lastJob ? new Date(lastJob.created_at) : null;

  // "live" is a claim about data we can actually see. A failed call or a
  // capture with no timestamp is unknown, never live (PRD §7).
  const freshness: 'live' | 'stale' | 'unknown' =
    dashboard.error || jobs.error || !analysedAt || !now ? 'unknown'
      : now - analysedAt.getTime() > FRESH_FOR_MS ? 'stale'
        : 'live';
  const FRESHNESS = {
    live:    { text: '● LIVE',    color: C.teal },
    stale:   { text: '◍ STALE',   color: C.medium },
    unknown: { text: '○ NO DATA', color: C.dim },
  }[freshness];

  const topIncident: Incident | undefined = summary?.top_incidents?.[0];
  const alerts: Alert[] = summary?.recent_alerts ?? [];
  const hosts: Entity[] = (entities.data ?? []).filter(e => e.kind === 'internal');
  const destinations: Entity[] = (entities.data ?? []).filter(e => e.kind === 'external');

  const kpis = [
    { label: 'Total flows',     value: summary?.total_flows,      color: C.text },
    { label: 'Suspicious',      value: summary?.suspicious_flows, color: C.medium },
    { label: 'High risk',       value: summary?.high_risk,        color: C.critical },
    { label: 'Incidents',       value: summary?.incidents,        color: C.high },
    { label: 'Protocols',       value: summary?.protocols,        color: C.teal },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100%', color: C.text, ...SANS }}>

      {/* ── 1 · Header + KPI rail ──────────────────────────────────────────── */}
      <Band first>
        <Label text="Perimeter · what's being watched" />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 400, color: C.text, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.2 }}>
              {lastJob?.filename ?? 'No capture loaded'}
            </h1>
            <p style={{ ...MONO, fontSize: '0.6rem', color: C.dim, marginTop: '0.3rem', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Severity and state are never colour alone (PRD §10). */}
              <span style={{ color: FRESHNESS.color }}>{FRESHNESS.text}</span>
              <span>·</span>
              <span>{analysedAt ? `analysed ${analysedAt.toLocaleString()}` : 'no analysis yet'}</span>
              {health.data && <><span>·</span><span>DPI {health.data.dpi_mode}</span></>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button onClick={reloadAll}>Refresh</Button>
            <GhostLink href="/captures">Upload PCAP</GhostLink>
            <GhostLink href="/network/mesh" accent>Launch Graph Mesh »</GhostLink>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          {dashboard.error ? (
            <Failure error={dashboard.error} onRetry={reloadAll} />
          ) : dashboard.loading && !summary ? (
            <Skeleton rows={2} />
          ) : (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 1, background: C.border, border: `1px solid ${C.border}`,
            }}>
              {kpis.map(k => (
                <div key={k.label} style={{ padding: '1rem 1.25rem', background: C.bg }}>
                  <span style={{ ...MONO, fontSize: '1.2rem', fontWeight: 500, color: k.color, display: 'block', marginBottom: '0.2rem' }}>
                    {k.value ?? '—'}
                  </span>
                  <span style={{ ...MONO, fontSize: '0.55rem', color: C.dim, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block' }}>
                    {k.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Band>

      {/* ── 2 · Highest-priority incident ──────────────────────────────────── */}
      <Band>
        <Label text="Signal · highest-priority incident" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <H2>Active investigation</H2>
          {topIncident && <MoreLink href={`/incidents/${topIncident.incident_id}`}>Open incident »</MoreLink>}
        </div>

        {dashboard.loading && !summary ? <Skeleton rows={3} />
          : !topIncident ? (
            <Note>
              No incident has been correlated in this capture.
              {' '}<Link href="/captures" style={{ color: C.teal }}>Upload a capture</Link> to analyse traffic.
            </Note>
          ) : (
            <div style={{
              display: 'flex', gap: '1rem',
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${SEV_COLOR[topIncident.severity] ?? C.muted}`,
              background: 'rgba(4,6,12,0.7)', padding: '1.1rem 1.25rem',
            }}>
              <span style={{ ...MONO, fontSize: '0.55rem', color: SEV_COLOR[topIncident.severity] ?? C.muted, letterSpacing: '0.06em', width: '2.8rem', flexShrink: 0, paddingTop: '0.15rem' }}>
                INC
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ ...MONO, fontSize: '0.6rem', color: C.teal }}>{topIncident.incident_id}</span>
                  <SevBadge sev={topIncident.severity} />
                  <span style={{ ...MONO, fontSize: '0.55rem', color: C.muted }}>RISK {topIncident.risk}</span>
                  <span style={{ ...MONO, fontSize: '0.55rem', color: C.muted }}>STATUS {topIncident.status}</span>
                </div>
                <div style={{ fontSize: '0.88rem', color: C.text, marginBottom: '0.35rem' }}>{topIncident.title}</div>
                <div style={{ fontSize: '0.75rem', color: C.muted, fontWeight: 300, lineHeight: 1.65, maxWidth: '72ch' }}>
                  {topIncident.root_hypothesis || topIncident.narrative?.[0] || 'No narrative recorded.'}
                </div>
                {topIncident.primary_host && (
                  <div style={{ ...MONO, fontSize: '0.6rem', color: C.dim, marginTop: '0.5rem' }}>
                    {topIncident.primary_host}
                    {topIncident.primary_destination ? ` → ${topIncident.primary_destination}` : ''}
                  </div>
                )}
              </div>
            </div>
          )}
      </Band>

      {/* ── 3 · Noisiest host + riskiest destination ───────────────────────── */}
      <Band>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
          {[
            { label: 'Hosts · internal talkers', title: 'Noisiest hosts', rows: hosts, href: '/network/hosts' },
            { label: 'Destinations · external', title: 'Riskiest destinations', rows: destinations, href: '/network/destinations' },
          ].map(section => (
            <div key={section.title}>
              <Label text={section.label} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <H2>{section.title}</H2>
                <MoreLink href={section.href}>All »</MoreLink>
              </div>
              {entities.error ? <Failure error={entities.error} onRetry={entities.reload} compact />
                : entities.loading && !entities.data ? <Skeleton />
                : section.rows.length === 0 ? <Note>Nothing in this capture.</Note>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: '0.68rem' }}>
                    <thead>
                      <tr>
                        <th style={TH}>Address</th>
                        <th style={TH}>Kind</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Flows</th>
                        <th style={{ ...TH, textAlign: 'right' }}>Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.slice(0, 5).map(e => (
                        <tr key={e.id}>
                          <td style={TDA}>{e.label}</td>
                          <td style={TD}>{e.kind}</td>
                          <td style={{ ...TDP, textAlign: 'right' }}>{e.flow_count}</td>
                          <td style={{ ...TD, textAlign: 'right', color: e.risk > 0 ? C.high : C.muted }}>{e.risk}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          ))}
        </div>
      </Band>

      {/* ── 4 · Recent alerts ──────────────────────────────────────────────── */}
      <Band>
        <Label text="Synthesis · recent alerts" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <H2>Recent alerts</H2>
          <MoreLink href="/findings">All findings »</MoreLink>
        </div>

        {dashboard.error ? <Failure error={dashboard.error} onRetry={reloadAll} compact />
          : dashboard.loading && !summary ? <Skeleton rows={5} />
          : alerts.length === 0 ? (
            <Note>
              {summary?.total_flows
                ? `No suspicious behaviour was flagged across ${summary.total_flows} flows.`
                : 'No flows analysed yet.'}
            </Note>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: '0.68rem' }}>
              <thead>
                <tr>
                  <th style={TH}>Alert</th>
                  <th style={TH}>Entity</th>
                  <th style={TH}>Type</th>
                  <th style={TH}>Severity</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Risk</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.alert_id}>
                    <td style={TDA}>
                      <Link href={`/findings/${a.alert_id}`} style={{ color: C.teal, textDecoration: 'none' }}>
                        {a.alert_id}
                      </Link>
                    </td>
                    <td style={TDP}>{a.entity}</td>
                    <td style={TD}>{a.title}</td>
                    <td style={TD}><SevBadge sev={a.severity} /></td>
                    <td style={{ ...TD, textAlign: 'right', color: C.text }}>{a.risk_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Band>

      {/* ── 5 · Capture history ────────────────────────────────────────────── */}
      <Band>
        <Label text="Evidence · capture history" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <H2>Analysed captures</H2>
          <MoreLink href="/captures">Repository »</MoreLink>
        </div>

        {jobs.error ? <Failure error={jobs.error} onRetry={jobs.reload} compact />
          : jobs.loading && !jobs.data ? <Skeleton />
          : (jobs.data ?? []).length === 0 ? <Note>No capture has been analysed yet.</Note>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: '0.68rem' }}>
              <thead>
                <tr>
                  <th style={TH}>Source</th>
                  <th style={TH}>Analysed</th>
                  <th style={TH}>Result</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(jobs.data ?? []).slice(0, 6).map(j => (
                  <tr key={j.job_id}>
                    <td style={TDA}>{j.filename}</td>
                    <td style={TD}>{new Date(j.created_at).toLocaleString()}</td>
                    <td style={TDP}>{j.message}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <Button onClick={() => api.loadJob(j.job_id).then(reloadAll)}>Reopen</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Band>

    </div>
  );
}
