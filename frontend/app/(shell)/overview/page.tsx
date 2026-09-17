'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSensors, getIncidents, getFindings, getCaptures, getTriggers } from '@/lib/mock/services';
import type { Sensor, Incident, Finding, Capture, Trigger } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

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
  const map: Record<string, [string, string, string]> = {
    critical: [C.critical, 'rgba(232,72,58,0.3)',  'rgba(232,72,58,0.06)'],
    high:     [C.high,     'rgba(232,134,58,0.3)', 'rgba(232,134,58,0.06)'],
    medium:   [C.medium,   'rgba(232,201,58,0.3)', 'rgba(232,201,58,0.06)'],
    low:      [C.low,      'rgba(75,123,229,0.3)', 'rgba(75,123,229,0.06)'],
    info:     [C.muted,    C.border,               'transparent'],
  };
  const [color, border, bg] = map[sev] ?? map.info;
  return (
    <span style={{
      ...MONO, fontSize: '0.52rem', fontWeight: 700,
      letterSpacing: '0.08em', color,
      border: `1px solid ${border}`, background: bg,
      padding: '1px 5px',
    }}>{sev.toUpperCase()}</span>
  );
}

// Hairline table styles
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
const TDA: React.CSSProperties = { ...TD, color: C.teal };    // accent (IDs)
const TDP: React.CSSProperties = { ...TD, color: C.text };    // primary

// ─── Band / Section wrapper ───────────────────────────────────────────────────
function Band({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      padding: '2rem 2.5rem',
      borderTop: first ? 'none' : `1px solid ${C.border}`,
    }}>
      {children}
    </div>
  );
}

// ─── Section h2 ──────────────────────────────────────────────────────────────
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      ...SANS, fontSize: '1.05rem', fontWeight: 400,
      color: C.text, letterSpacing: '-0.02em',
      margin: '0.2rem 0 1rem', lineHeight: 1.2,
    }}>{children}</h2>
  );
}

// ─── Ghost button / link ──────────────────────────────────────────────────────
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
      ...MONO, fontSize: '0.6rem',
      color: hov ? C.text : C.dim,
      textDecoration: 'none', letterSpacing: '0.04em',
      transition: 'color 0.12s',
    }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >{children}</Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [sensors,   setSensors]   = useState<Sensor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [findings,  setFindings]  = useState<Finding[]>([]);
  const [captures,  setCaptures]  = useState<Capture[]>([]);
  const [triggers,  setTriggers]  = useState<Trigger[]>([]);

  useEffect(() => {
    getSensors().then(setSensors);
    getIncidents().then(setIncidents);
    getFindings().then(setFindings);
    getCaptures().then(setCaptures);
    getTriggers().then(setTriggers);
  }, []);

  const spotInc = incidents[0];

  return (
    <div style={{ background: C.bg, minHeight: '100%', color: C.text, ...SANS }}>

      {/* ── 1 · Hero band ─────────────────────────────────────────────────── */}
      <Band first>
        <Label text="Perimeter · what's being watched" />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 400, color: C.text, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.2 }}>
              Acme Financial Services
            </h1>
            <p style={{ ...MONO, fontSize: '0.6rem', color: C.dim, marginTop: '0.3rem', letterSpacing: '0.04em' }}>
              Q3 Network Security Assessment · 3 sensors active
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <GhostLink href="/monitor">Start Live Capture</GhostLink>
            <GhostLink href="/captures">Upload PCAP</GhostLink>
            <GhostLink href="/network/mesh" accent>Launch Graph Mesh »</GhostLink>
          </div>
        </div>

        {/* Metric strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1, background: C.border,
          border: `1px solid ${C.border}`, marginTop: '1.5rem',
        }}>
          {[
            { label: 'Preserved Capture', value: '684 MB', color: C.text,     sub: 'CAP-1050 · SHA-256 verified',     subColor: C.teal },
            { label: 'Open Incidents',    value: String(incidents.length || 1), color: C.critical, sub: 'INC-2026-041 · Critical 91', subColor: C.critical },
            { label: 'Correlated Findings', value: String(findings.length || 5), color: C.high, sub: '5 threat signals',        subColor: C.high },
            { label: 'Fleet Throughput',  value: '1.25 Gbps', color: C.teal, sub: '27,660 pps live',               subColor: C.muted },
          ].map(m => (
            <div key={m.label} style={{ padding: '1rem 1.25rem', background: C.bg }}>
              <span style={{ ...MONO, fontSize: '1.2rem', fontWeight: 500, color: m.color, display: 'block', marginBottom: '0.2rem' }}>
                {m.value}
              </span>
              <span style={{ ...MONO, fontSize: '0.55rem', color: C.dim, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block' }}>
                {m.label}
              </span>
              <span style={{ ...MONO, fontSize: '0.55rem', color: m.subColor, display: 'block', marginTop: '0.3rem' }}>
                {m.sub}
              </span>
            </div>
          ))}
        </div>
      </Band>

      {/* ── 2 · Active incident band ───────────────────────────────────────── */}
      {spotInc && (
        <Band>
          <Label text="Signal · highest-priority incident" />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <H2>Active investigation</H2>
            <MoreLink href={`/incidents/${spotInc.id}`}>Workflow Investigation »</MoreLink>
          </div>

          {/* Feature card — arstraumur .feature-card style */}
          <div style={{
            display: 'flex', gap: '1rem',
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.critical}`,
            background: 'rgba(4,6,12,0.7)',
            padding: '1.1rem 1.25rem',
          }}>
            {/* Lead monogram */}
            <span style={{
              ...MONO, fontSize: '0.55rem', color: C.critical,
              letterSpacing: '0.06em', width: '2.8rem', flexShrink: 0,
              paddingTop: '0.15rem',
            }}>INC</span>

            <div style={{ flex: 1 }}>
              {/* Meta line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ ...MONO, fontSize: '0.6rem', color: C.teal }}>{spotInc.id}</span>
                <span style={{
                  ...MONO, fontSize: '0.52rem', fontWeight: 700,
                  color: C.critical, border: '1px solid rgba(232,72,58,0.3)',
                  background: 'rgba(232,72,58,0.06)', padding: '1px 5px', letterSpacing: '0.07em',
                }}>SCORE {spotInc.riskScore}</span>
                <span style={{ ...MONO, fontSize: '0.55rem', color: C.muted }}>
                  STATUS: {spotInc.status.toUpperCase()}
                </span>
              </div>
              {/* Title */}
              <div style={{ fontSize: '0.88rem', color: C.text, fontWeight: 400, marginBottom: '0.35rem' }}>
                {spotInc.title}
              </div>
              {/* Description */}
              <div style={{ fontSize: '0.75rem', color: C.muted, fontWeight: 300, lineHeight: 1.65, maxWidth: '72ch' }}>
                {spotInc.description}
              </div>
            </div>
          </div>
        </Band>
      )}

      {/* ── 3 · Two-column data band ───────────────────────────────────────── */}
      <Band>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>

          {/* Triggers table */}
          <div>
            <Label text="Triggers · preserved captures" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <H2>Preserved Triggers</H2>
              <MoreLink href="/sensors">Fleet Status »</MoreLink>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: '0.68rem' }}>
              <thead>
                <tr>
                  <th style={TH}>Trigger</th>
                  <th style={TH}>Score</th>
                  <th style={TH}>Target</th>
                  <th style={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {triggers.map(t => (
                  <tr key={t.id}>
                    <td style={TDA}>{t.id}</td>
                    <td style={TD}>
                      <SevBadge sev={t.severity} />
                      <span style={{ marginLeft: '0.4rem', color: C.text }}>{t.score}/100</span>
                    </td>
                    <td style={TDP}>{t.entityId}</td>
                    <td style={TD}>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Captures table */}
          <div>
            <Label text="Evidence · capture repository" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <H2>Evidence Captures</H2>
              <MoreLink href="/captures">Repository »</MoreLink>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: '0.68rem' }}>
              <thead>
                <tr>
                  <th style={TH}>Capture ID</th>
                  <th style={TH}>Type</th>
                  <th style={TH}>Size</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {captures.slice(0, 4).map(c => (
                  <tr key={c.id}>
                    <td style={TDA}>{c.id}</td>
                    <td style={TD}>{c.type}</td>
                    <td style={TDP}>{formatBytes(c.sizeBytes || 0)}</td>
                    <td style={{ ...TD, textAlign: 'right' }}>
                      <MoreLink href={`/captures/${c.id}`}>Inspect »</MoreLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Band>

      {/* ── 4 · Findings band ────────────────────────────────────────────────── */}
      <Band>
        <Label text="Synthesis · correlated findings" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <H2>Findings</H2>
          <MoreLink href="/findings">All findings »</MoreLink>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: '0.68rem' }}>
          <thead>
            <tr>
              <th style={TH}>ID</th>
              <th style={TH}>Title</th>
              <th style={TH}>Severity</th>
              <th style={TH}>Category</th>
              <th style={{ ...TH, textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {findings.map(f => (
              <tr key={f.id}>
                <td style={TDA}>{f.id}</td>
                <td style={TDP}>
                  <Link href={`/findings/${f.id}`}
                    style={{ color: C.text, textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = C.teal)}
                    onMouseLeave={e => (e.currentTarget.style.color = C.text)}
                  >{f.title}</Link>
                </td>
                <td style={TD}><SevBadge sev={f.severity} /></td>
                <td style={TD}>{f.category.replace(/_/g, ' ')}</td>
                <td style={{ ...TD, textAlign: 'right', color: C.text }}>{f.riskScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Band>

      {/* ── 5 · Sensor fleet band ─────────────────────────────────────────────── */}
      <Band>
        <Label text="Fleet · sensor nodes online" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <H2>Sensor Fleet</H2>
          <MoreLink href="/sensors">Manage sensors »</MoreLink>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', ...MONO, fontSize: '0.68rem' }}>
          <thead>
            <tr>
              <th style={TH}>Sensor</th>
              <th style={TH}>Host</th>
              <th style={TH}>OS</th>
              <th style={TH}>Status</th>
              <th style={TH}>Throughput</th>
              <th style={{ ...TH, textAlign: 'right' }}>Buffer</th>
            </tr>
          </thead>
          <tbody>
            {sensors.map(s => {
              const sc = s.status === 'online' ? C.teal : s.status === 'degraded' ? C.medium : C.critical;
              return (
                <tr key={s.id}>
                  <td style={TDA}>{s.id}</td>
                  <td style={TDP}>{s.hostname}</td>
                  <td style={TD}>{s.os}</td>
                  <td style={TD}>
                    <span style={{ ...MONO, fontSize: '0.52rem', fontWeight: 700, color: sc, letterSpacing: '0.08em' }}>
                      {s.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={TDP}>{s.metrics.mbps} Mbps</td>
                  <td style={{ ...TD, textAlign: 'right', color: C.text }}>{s.metrics.bufferPercent}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Band>

    </div>
  );
}
