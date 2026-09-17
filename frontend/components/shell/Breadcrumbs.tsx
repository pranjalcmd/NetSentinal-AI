'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, LayoutDashboard } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Segment → human-readable label map
// ─────────────────────────────────────────────────────────────────────────────

const SEGMENT_LABELS: Record<string, string> = {
  overview:      'Overview',
  monitor:       'Monitor',
  capture:       'Manual Capture',
  captures:      'Captures',
  investigations:'Investigations',
  new:           'New',
  upload:        'Upload PCAP',
  progress:      'Analysis Progress',
  traffic:       'Traffic',
  network:       'Network',
  hosts:         'Hosts',
  destinations:  'Destinations',
  services:      'Services',
  mesh:          'Network Mesh',
  findings:      'Findings',
  incidents:     'Incidents',
  timeline:      'Timeline',
  hunt:          'Hunt',
  sensors:       'Sensors',
  reports:       'Reports',
  ai:            'AI Investigator',
  evidence:      'Evidence',
  health:        'System Health',
  customers:     'Customers',
  engagements:   'Engagements',
  admin:         'Admin',
  users:         'Users & Roles',
  audit:         'Audit Log',
  models:        'Model Versions',
  settings:      'Settings',
  integrations:  'Integrations',
  notifications: 'Notifications',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert a raw path segment to its display label
// ─────────────────────────────────────────────────────────────────────────────

function segmentToLabel(segment: string): string {
  // Check known map first
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];

  // If it looks like an ID (contains hyphens + alphanumeric), truncate for display
  if (/^[a-z0-9]+-[a-z0-9-]+$/i.test(segment)) {
    return segment.length > 14 ? `${segment.slice(0, 12)}…` : segment;
  }

  // Fallback: capitalise first letter
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Breadcrumbs
// ─────────────────────────────────────────────────────────────────────────────

export function Breadcrumbs() {
  const pathname = usePathname();

  // Split path into non-empty segments
  const segments = pathname.split('/').filter(Boolean);

  // Build cumulative hrefs
  // e.g. /network/mesh → ['/network', '/network/mesh']
  const crumbs: Array<{ label: string; href: string; isLast: boolean }> = segments.map(
    (seg, idx) => ({
      label: segmentToLabel(seg),
      href: '/' + segments.slice(0, idx + 1).join('/'),
      isLast: idx === segments.length - 1,
    }),
  );

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* ── Home icon ─────────────────────────────────────────── */}
      <Link
        href="/overview"
        style={{
          display: 'flex',
          alignItems: 'center',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          padding: '2px 4px',
          borderRadius: '3px',
          transition: 'color 0.12s ease',
          flexShrink: 0,
        }}
        title="Overview"
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')
        }
      >
        <LayoutDashboard size={13} />
      </Link>

      {/* ── Crumb segments ───────────────────────────────────── */}
      {crumbs.map((crumb) => (
        <span
          key={crumb.href}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}
        >
          {/* Separator chevron */}
          <ChevronRight
            size={11}
            style={{ color: 'var(--text-disabled)', flexShrink: 0 }}
          />

          {crumb.isLast ? (
            /* Last segment — current page, not a link */
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '160px',
              }}
            >
              {crumb.label}
            </span>
          ) : (
            /* Ancestor segments — clickable links */
            <Link
              href={crumb.href}
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '120px',
                borderRadius: '3px',
                padding: '1px 3px',
                transition: 'color 0.12s ease',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)')
              }
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}

      {/* ── Empty state (root) ───────────────────────────────── */}
      {crumbs.length === 0 && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginLeft: '4px',
          }}
        >
          Overview
        </span>
      )}
    </nav>
  );
}
