'use client';

import { useBackendStatus } from '@/lib/useApi';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from './AppShell';

import { PrismLogoIcon } from '@/components/graphics/PrismLogo';

const NAV = [
  {
    group: 'Monitor',
    sub: "what's being watched",
    items: [
      { label: 'Overview',     href: '/overview' },
      { label: 'Live Traffic', href: '/monitor' },
      { label: 'Captures',     href: '/captures' },
    ],
  },
  {
    group: 'Investigate',
    sub: 'packet-level depth',
    items: [
      { label: 'Network Mesh',   href: '/network/mesh' },
      { label: 'Investigations', href: '/investigations' },
      { label: 'Flow Explorer',  href: '/traffic' },
      { label: 'Findings',       href: '/findings' },
      { label: 'Incidents',      href: '/incidents' },
      { label: 'Timeline',       href: '/timeline' },
      { label: 'Threat Hunt',    href: '/hunt' },
    ],
  },
  {
    group: 'Operate',
    sub: 'fleet & deliverables',
    items: [
      { label: 'Sensors',       href: '/sensors' },
      { label: 'Reports',       href: '/reports' },
      { label: 'AI Assistant',  href: '/ai' },
      { label: 'System Health', href: '/health' },
      { label: 'Settings',      href: '/settings' },
    ],
  },
];

export function Sidebar() {
  const backend = useBackendStatus();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/overview'
      ? pathname === '/' || pathname === '/overview'
      : pathname.startsWith(href);

  return (
    <aside style={{
      width: 196,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: '#04060c',
      borderRight: '1px solid #1A2230',
      fontFamily: "'IBM Plex Mono', monospace",
      userSelect: 'none',
    }}>

      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.1rem',
        borderBottom: '1px solid #1A2230',
        gap: '0.5rem',
      }}>
        <PrismLogoIcon size={20} />
        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.08em' }}>
          PRISM
        </span>
        <span style={{
          fontSize: '0.50rem', color: '#3DD9C4',
          border: '1px solid rgba(61,217,196,0.35)',
          padding: '1px 5px', letterSpacing: '0.06em', borderRadius: '3px', fontWeight: 700
        }}>SEC</span>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0 1rem' }}>
        {NAV.map(({ group, sub, items }) => (
          <div key={group} style={{ marginBottom: '1.1rem' }}>

            {/* Group label — arstraumur .label style */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '0 1.1rem', marginBottom: '0.2rem',
              gap: 0,
            }}>
              <span style={{
                fontSize: '0.56rem', color: '#3a4455',
                letterSpacing: '0.06em', whiteSpace: 'nowrap',
              }}>
                {group}
                <span style={{ color: '#242B36' }}> · </span>
                <span style={{ color: '#2a333f', fontStyle: 'italic' }}>{sub}</span>
              </span>
              <span style={{ flex: 1, height: 1, background: '#141c26', marginLeft: '0.5rem' }} />
            </div>

            {items.map(({ label, href }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} style={{
                  display: 'block',
                  padding: '0.28rem 1.1rem',
                  fontSize: '0.68rem',
                  fontWeight: active ? 400 : 300,
                  color: active ? '#3DD9C4' : '#4e5f72',
                  textDecoration: 'none',
                  borderLeft: `2px solid ${active ? '#3DD9C4' : 'transparent'}`,
                  background: active ? 'rgba(61,217,196,0.04)' : 'transparent',
                  letterSpacing: '0.01em',
                  transition: 'color 0.12s, border-color 0.12s, background 0.12s',
                }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = '#E4E8EE';
                      (e.currentTarget as HTMLElement).style.borderLeftColor = '#242B36';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = '#4e5f72';
                      (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                    }
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Sensor footer ────────────────────────────────────────────── */}
      <div style={{
        padding: '0.7rem 1.1rem',
        borderTop: '1px solid #1A2230',
        fontSize: '0.58rem',
        color: '#3a4455',
        letterSpacing: '0.04em',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.18rem' }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#3DD9C4', boxShadow: '0 0 6px #3DD9C4',
          }} />
          <span style={{ color: '#3DD9C4', letterSpacing: '0.06em' }}>
            {backend.online === false ? 'API OFFLINE' : backend.dpiMode ?? 'CONNECTING'}
          </span>
        </div>
        <div>{backend.flows !== null ? `${backend.flows} flows in store` : 'awaiting analysis'}</div>
      </div>
    </aside>
  );
}
