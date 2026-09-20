'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
  HardDrive,
  Monitor,
  Search,
  ShieldAlert,
  Wifi,
  X,
  ArrowRight,
  Zap,
} from 'lucide-react';
import type { SearchResult } from '@/lib/types';
import { searchAll } from '@/lib/mock';
import { useAppContext } from './AppShell';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ResultType = SearchResult['type'];

interface GroupedResults {
  type: ResultType;
  label: string;
  results: SearchResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ResultType, { label: string; icon: React.ReactNode; color: string }> = {
  finding: {
    label: 'Findings',
    icon: <AlertTriangle size={13} />,
    color: 'var(--risk-high)',
  },
  incident: {
    label: 'Incidents',
    icon: <ShieldAlert size={13} />,
    color: 'var(--risk-critical)',
  },
  host: {
    label: 'Hosts',
    icon: <Monitor size={13} />,
    color: 'var(--accent-blue)',
  },
  capture: {
    label: 'Captures',
    icon: <HardDrive size={13} />,
    color: '#a78bfa', // purple
  },
  sensor: {
    label: 'Sensors',
    icon: <Wifi size={13} />,
    color: 'var(--status-online)',
  },
  destination: {
    label: 'Destinations',
    icon: <ArrowRight size={13} />,
    color: 'var(--risk-medium)',
  },
  flow: {
    label: 'Flows',
    icon: <Zap size={13} />,
    color: 'var(--text-muted)',
  },
  trigger: {
    label: 'Triggers',
    icon: <Zap size={13} />,
    color: 'var(--risk-high)',
  },
};

// Recent items — deterministic mock data
const RECENT_ITEMS: SearchResult[] = [
  {
    type: 'incident',
    id: 'inc-001',
    title: 'APT-Style Intrusion — Acme Financial Trading Floor',
    subtitle: 'Score 96 · investigating · 4 findings',
    score: 96,
    timestamp: '2026-09-17T16:18:00Z',
    url: '/incidents/inc-001',
  },
  {
    type: 'finding',
    id: 'find-001',
    title: 'DNS Tunneling — Exfiltration Suspected',
    subtitle: 'CRITICAL · Score 94 · confirmed',
    severity: 'critical',
    score: 94,
    timestamp: '2026-09-17T16:18:00Z',
    url: '/findings/find-001',
  },
  {
    type: 'host',
    id: 'host-004',
    title: 'ACMEFIN-SRV017',
    subtitle: '10.0.4.17 · Risk 94 · 1 finding',
    score: 94,
    timestamp: '2026-09-17T16:18:00Z',
    url: '/network/hosts/host-004',
  },
  {
    type: 'capture',
    id: 'cap-0044',
    title: 'cap-0044',
    subtitle: 'AUTO_PRESERVED · ANALYZED · SNS-042',
    timestamp: '2026-09-17T15:40:00Z',
    url: '/captures/cap-0044',
  },
];

// Quick-action commands
interface QuickAction {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: React.ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'upload-pcap',
    label: 'Upload PCAP File',
    description: 'Upload and analyse an external capture file',
    url: '/captures/upload',
    icon: <HardDrive size={13} style={{ color: 'var(--accent-blue)' }} />,
  },
  {
    id: 'view-incidents',
    label: 'Open Incidents',
    description: 'View all active incidents',
    url: '/incidents',
    icon: <ShieldAlert size={13} style={{ color: 'var(--risk-critical)' }} />,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Severity colour helper
// ─────────────────────────────────────────────────────────────────────────────

function severityColor(severity?: string): string {
  switch (severity) {
    case 'critical': return 'var(--risk-critical)';
    case 'high':     return 'var(--risk-high)';
    case 'medium':   return 'var(--risk-medium)';
    case 'low':      return 'var(--risk-low)';
    default:         return 'var(--text-muted)';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Result row component
// ─────────────────────────────────────────────────────────────────────────────

interface ResultRowProps {
  result: SearchResult;
  isFocused: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function ResultRow({ result, isFocused, onSelect, onHover }: ResultRowProps) {
  const config = TYPE_CONFIG[result.type] ?? {
    label: result.type,
    icon: <Search size={13} />,
    color: 'var(--text-muted)',
  };

  return (
    <button
      role="option"
      aria-selected={isFocused}
      onClick={onSelect}
      onMouseEnter={onHover}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px',
        background: isFocused ? 'var(--bg-elevated)' : 'transparent',
        border: 'none',
        borderLeft: isFocused ? `2px solid var(--accent-blue)` : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.08s ease',
      }}
    >
      {/* Type icon */}
      <span
        style={{
          color: config.color,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {config.icon}
      </span>

      {/* Labels */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {result.title}
        </div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '1px',
          }}
        >
          {result.subtitle}
        </div>
      </div>

      {/* Score badge (if applicable) */}
      {result.score !== undefined && (
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 600,
            color: result.severity ? severityColor(result.severity) : 'var(--text-muted)',
            flexShrink: 0,
            background: result.severity
              ? `${severityColor(result.severity)}18`
              : 'var(--bg-overlay)',
            padding: '1px 5px',
            borderRadius: '3px',
          }}
        >
          {result.score}
        </span>
      )}

      {/* Navigate arrow */}
      {isFocused && (
        <ArrowRight
          size={11}
          style={{ color: 'var(--accent-blue)', flexShrink: 0 }}
        />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick action row
// ─────────────────────────────────────────────────────────────────────────────

interface QuickActionRowProps {
  action: QuickAction;
  isFocused: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function QuickActionRow({ action, isFocused, onSelect, onHover }: QuickActionRowProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 14px',
        background: isFocused ? 'var(--bg-elevated)' : 'transparent',
        border: 'none',
        borderLeft: isFocused ? `2px solid var(--accent-blue)` : '2px solid transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.08s ease',
      }}
    >
      <span style={{ flexShrink: 0 }}>{action.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {action.label}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
          {action.description}
        </div>
      </div>
      {isFocused && (
        <ArrowRight size={11} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 14px 4px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-disabled)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {icon && <span style={{ opacity: 0.6 }}>{icon}</span>}
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommandPalette
// ─────────────────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useAppContext();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Search results ──────────────────────────────────────────────────────

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    return searchAll(query);
  }, [query]);

  // Group search results by type
  const groupedResults = useMemo<GroupedResults[]>(() => {
    const groupMap = new Map<ResultType, SearchResult[]>();

    for (const result of searchResults) {
      if (!groupMap.has(result.type)) groupMap.set(result.type, []);
      groupMap.get(result.type)!.push(result);
    }

    return Array.from(groupMap.entries()).map(([type, results]) => ({
      type,
      label: TYPE_CONFIG[type]?.label ?? type,
      results,
    }));
  }, [searchResults]);

  // Flat navigable items list
  const flatItems = useMemo<Array<{ url: string; type: 'result' | 'action' }>>(
    () => {
      const isSearching = query.trim().length > 0;
      if (isSearching) {
        return searchResults.map((r) => ({ url: r.url, type: 'result' as const }));
      }
      // Empty state: recent items + quick actions
      return [
        ...RECENT_ITEMS.map((r) => ({ url: r.url, type: 'result' as const })),
        ...QUICK_ACTIONS.map((a) => ({ url: a.url, type: 'action' as const })),
      ];
    },
    [query, searchResults],
  );

  // ── Navigation ──────────────────────────────────────────────────────────

  const navigate = useCallback(
    (url: string) => {
      setCommandPaletteOpen(false);
      setQuery('');
      setFocusedIndex(0);
      router.push(url);
    },
    [router, setCommandPaletteOpen],
  );

  // ── Keyboard handling ───────────────────────────────────────────────────

  useEffect(() => {
    if (!commandPaletteOpen) return;
    // Focus input when opened
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [commandPaletteOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[focusedIndex]) navigate(flatItems[focusedIndex].url);
          break;
        case 'Escape':
          e.preventDefault();
          setCommandPaletteOpen(false);
          setQuery('');
          setFocusedIndex(0);
          break;
      }
    },
    [flatItems, focusedIndex, navigate, setCommandPaletteOpen],
  );

  // Scroll focused item into view
  useEffect(() => {
    if (!listRef.current) return;
    const focused = listRef.current.querySelector('[aria-selected="true"]');
    if (focused) focused.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  // Focus resets where the query changes, below — an effect watching `query`
  // would set state during render commit for the same result.

  if (!commandPaletteOpen) return null;

  const isSearching = query.trim().length > 0;

  // Calculate flat indices for results vs actions in empty state
  const recentCount = RECENT_ITEMS.length;

  return (
    <>
      {/* ── Overlay ──────────────────────────────────────────── */}
      <div
        className="command-palette-overlay"
        onClick={() => {
          setCommandPaletteOpen(false);
          setQuery('');
          setFocusedIndex(0);
        }}
        aria-hidden="true"
      />

      {/* ── Palette dialog ───────────────────────────────────── */}
      <div
        className="command-palette-overlay"
        style={{ pointerEvents: 'none' }}
        aria-modal="true"
        role="dialog"
        aria-label="Command palette"
      >
        <div
          className="command-palette"
          style={{ pointerEvents: 'all' }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={true}
          aria-haspopup="listbox"
          aria-controls="command-palette-results"
        >
          {/* ── Search input ───────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocusedIndex(0); }}
              placeholder="Search findings, incidents, hosts, captures, sensors…"
              aria-label="Search"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontFamily: 'inherit',
                caretColor: 'var(--accent-blue)',
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                aria-label="Clear search"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  borderRadius: '3px',
                }}
              >
                <X size={13} />
              </button>
            )}
            <kbd
              style={{
                fontSize: '10px',
                color: 'var(--text-disabled)',
                fontFamily: 'monospace',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: '3px',
                padding: '1px 5px',
                flexShrink: 0,
              }}
            >
              ESC
            </kbd>
          </div>

          {/* ── Results list ───────────────────────────────── */}
          <div
            id="command-palette-results"
            ref={listRef}
            role="listbox"
            aria-label="Search results"
            style={{ overflowY: 'auto', maxHeight: '400px' }}
          >
            {/* ── Search mode ────────────────────────────── */}
            {isSearching && (
              <>
                {groupedResults.length === 0 ? (
                  /* No results */
                  <div
                    style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                    }}
                  >
                    <Search
                      size={24}
                      style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }}
                    />
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  /* Grouped results */
                  (() => {
                    let flatIdx = 0;
                    return groupedResults.map((group) => {
                      const config = TYPE_CONFIG[group.type];
                      return (
                        <div key={group.type}>
                          <SectionHeader label={group.label} icon={config?.icon} />
                          {group.results.map((result) => {
                            const idx = flatIdx++;
                            return (
                              <ResultRow
                                key={result.id}
                                result={result}
                                isFocused={focusedIndex === idx}
                                onSelect={() => navigate(result.url)}
                                onHover={() => setFocusedIndex(idx)}
                              />
                            );
                          })}
                        </div>
                      );
                    });
                  })()
                )}
              </>
            )}

            {/* ── Empty / default mode ───────────────────── */}
            {!isSearching && (
              <>
                {/* Recent items */}
                <SectionHeader
                  label="Recent"
                  icon={<Clock size={10} />}
                />
                {RECENT_ITEMS.map((item, idx) => (
                  <ResultRow
                    key={item.id}
                    result={item}
                    isFocused={focusedIndex === idx}
                    onSelect={() => navigate(item.url)}
                    onHover={() => setFocusedIndex(idx)}
                  />
                ))}

                {/* Quick actions */}
                <SectionHeader label="Quick Actions" />
                {QUICK_ACTIONS.map((action, idx) => {
                  const flatIdx = recentCount + idx;
                  return (
                    <QuickActionRow
                      key={action.id}
                      action={action}
                      isFocused={focusedIndex === flatIdx}
                      onSelect={() => navigate(action.url)}
                      onHover={() => setFocusedIndex(flatIdx)}
                    />
                  );
                })}
              </>
            )}
          </div>

          {/* ── Footer hint bar ────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '8px 14px',
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
            }}
          >
            {[
              { key: '↑↓', label: 'navigate' },
              { key: '↵', label: 'open' },
              { key: 'ESC', label: 'close' },
            ].map(({ key, label }) => (
              <span
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  color: 'var(--text-disabled)',
                }}
              >
                <kbd
                  style={{
                    fontFamily: 'monospace',
                    background: 'var(--bg-overlay)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '3px',
                    padding: '0 4px',
                    fontSize: '10px',
                  }}
                >
                  {key}
                </kbd>
                {label}
              </span>
            ))}
            <div style={{ flex: 1 }} />
            {isSearching && searchResults.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-disabled)', fontFamily: 'monospace' }}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
