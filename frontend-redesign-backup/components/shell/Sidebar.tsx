'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Upload, Network, ListChecks, AlertTriangle,
  Bot, HeartPulse,
} from 'lucide-react';

// Only pages backed by the real analysis backend stay in the navigation.
const NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Home',         href: '/overview',  icon: Home },
    ],
  },
  {
    group: 'Analysis',
    items: [
      { label: 'Upload PCAP',   href: '/investigations/new/upload', icon: Upload },
      { label: 'Network Graph', href: '/network/mesh',              icon: Network },
    ],
  },
  {
    group: 'Security',
    items: [
      { label: 'Findings',      href: '/findings',  icon: ListChecks },
      { label: 'Incidents',     href: '/incidents', icon: AlertTriangle },
    ],
  },
  {
    group: 'Tools',
    items: [
      { label: 'AI Assistant',  href: '/ai',     icon: Bot },
      { label: 'System Health', href: '/health', icon: HeartPulse },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/overview'
      ? pathname === '/' || pathname === '/overview'
      : pathname.startsWith(href);

  return (
    <aside
      className="flex flex-col shrink-0 bg-[#04060c] border-r border-[#1A2230] select-none"
      style={{ width: 208 }}
    >
      {/* Brand — clicking it goes home */}
      <Link
        href="/overview"
        className="flex items-center gap-2.5 h-12 px-5 border-b border-[#1A2230] no-underline"
      >
        <span className="w-2 h-2 rounded-full bg-[#3DD9C4] shrink-0" />
        <span className="text-sm font-medium text-[#E4E8EE] tracking-tight">NetSentinel</span>
        <span className="text-[0.6rem] text-[#3DD9C4] border border-[#3DD9C4]/30 px-1 py-px">
          AI
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto py-4">
        {NAV.map(({ group, items }) => (
          <div key={group} className="mb-5">
            <p className="px-5 mb-1.5 text-[0.6rem] uppercase tracking-wider text-[#4a5568]">
              {group}
            </p>
            {items.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 py-1.5 pr-3 pl-[18px] text-[0.8rem] no-underline transition-colors duration-150"
                  style={{
                    color: active ? '#3DD9C4' : '#8b98ab',
                    borderLeft: `2px solid ${active ? '#3DD9C4' : 'transparent'}`,
                    background: active ? 'rgba(61,217,196,0.05)' : 'transparent',
                    fontWeight: active ? 500 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = '#E4E8EE';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = '#8b98ab';
                  }}
                >
                  <Icon size={15} strokeWidth={active ? 2 : 1.6} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
