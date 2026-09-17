'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppContext } from './AppShell';

const CRUMB: Record<string, string> = {
  overview: 'Home', monitor: 'Live Traffic', captures: 'Captures',
  network: 'Network', mesh: 'Network Graph', investigations: 'Investigations',
  new: 'New', upload: 'Upload PCAP', traffic: 'Flow Explorer',
  findings: 'Findings', incidents: 'Incidents', timeline: 'Timeline',
  hunt: 'Threat Hunt', sensors: 'Sensors', reports: 'Reports',
  ai: 'AI Assistant', health: 'System Health', settings: 'Settings',
  customers: 'Customers', engagements: 'Engagements', admin: 'Admin',
};

export function Topbar() {
  const pathname = usePathname();
  const { setCommandPaletteOpen } = useAppContext();
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

  return (
    <header
      className="flex items-center justify-between h-12 px-6 border-b border-[#1A2230] shrink-0 sticky top-0 z-40 transition-colors duration-200"
      style={{ background: scrolled ? 'rgba(4,6,12,0.94)' : '#04060c' }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-[0.75rem]" aria-label="Breadcrumb">
        <Link href="/overview" className="text-[#5a6779] no-underline hover:text-[#8b98ab]">
          NetSentinel
        </Link>
        {crumbs.map((c) => (
          <React.Fragment key={c.href}>
            <span className="text-[#242B36] mx-1">/</span>
            <Link
              href={c.href}
              className="no-underline"
              style={{ color: c.isLast ? '#E4E8EE' : '#5a6779' }}
            >
              {c.label}
            </Link>
          </React.Fragment>
        ))}
      </nav>

      {/* Command palette hint */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="text-[0.7rem] text-[#5a6779] border border-[#1A2230] bg-transparent px-2 py-1 cursor-pointer transition-colors duration-150 hover:border-[#3DD9C4] hover:text-[#3DD9C4]"
      >
        Ctrl K
      </button>
    </header>
  );
}
