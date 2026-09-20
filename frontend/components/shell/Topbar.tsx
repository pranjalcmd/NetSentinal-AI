'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from './AppShell';

const CRUMB: Record<string, string> = {
  overview: 'Overview', monitor: 'Live Traffic', captures: 'Captures',
  network: 'Network', mesh: 'Mesh', investigations: 'Investigations',
  traffic: 'Flow Explorer', findings: 'Findings', incidents: 'Incidents',
  timeline: 'Timeline', hunt: 'Threat Hunt', sensors: 'Sensors',
  reports: 'Reports', ai: 'AI Assistant', health: 'System Health',
  settings: 'Settings', customers: 'Customers', engagements: 'Engagements',
  admin: 'Admin',
};

export function Topbar() {
  const pathname = usePathname();
  const { customer, engagement, setCommandPaletteOpen } = useAppContext();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.querySelector('main');
    if (!el) return;
    const fn = () => setScrolled(el.scrollTop > 8);
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, []);

  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((s, i) => ({
    label: CRUMB[s] ?? s,
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  const mono: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace",
  };

  return (
    <header style={{
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      borderBottom: '1px solid #1A2230',
      background: scrolled ? 'rgba(4,6,12,0.94)' : '#04060c',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      flexShrink: 0,
      transition: 'background 0.2s',
    }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', ...mono, fontSize: '0.62rem', color: '#3a4455' }}>
        <Link href="/" style={{ color: '#3a4455', textDecoration: 'none', fontWeight: 600 }}>PRISM</Link>
        {crumbs.map(c => (
          <React.Fragment key={c.href}>
            <span style={{ color: '#1A2230', margin: '0 0.15rem' }}>·</span>
            <Link href={c.href} style={{
              color: c.isLast ? '#E4E8EE' : '#3a4455',
              textDecoration: 'none',
              letterSpacing: '0.01em',
            }}>{c.label}</Link>
          </React.Fragment>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

        {/* Scope */}
        <div style={{ ...mono, fontSize: '0.58rem', color: '#3a4455', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span>{customer.name}</span>
          <span style={{ color: '#1A2230' }}>·</span>
          <span style={{ color: '#515E72' }}>{engagement.name}</span>
        </div>

        {/* CMD K */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          style={{
            ...mono, fontSize: '0.58rem', color: '#3a4455',
            border: '1px solid #1A2230', background: 'transparent',
            padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.04em',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#3DD9C4';
            (e.currentTarget as HTMLButtonElement).style.color = '#3DD9C4';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#1A2230';
            (e.currentTarget as HTMLButtonElement).style.color = '#3a4455';
          }}
        >CMD K</button>

        {/* Live badge */}
        <div style={{ ...mono, fontSize: '0.58rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3DD9C4', boxShadow: '0 0 7px #3DD9C4', flexShrink: 0 }} />
          <span style={{ color: '#3DD9C4' }}>LIVE</span>
          <span style={{ color: '#3a4455' }}>SNS-042</span>
        </div>
      </div>
    </header>
  );
}
