'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  pageSize?: number;
  className?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getNestedValue(obj: unknown, key: string): unknown {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return obj;
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return '';
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function rowMatchesSearch<T>(row: T, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return Object.values(row as Record<string, unknown>).some((v) =>
    String(v ?? '').toLowerCase().includes(q),
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-800">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 animate-pulse rounded bg-slate-800"
                style={{ width: `${60 + Math.sin(i * 7 + j * 3) * 30}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === 'asc')
    return <ChevronUp className="h-3.5 w-3.5 text-blue-400" />;
  if (direction === 'desc')
    return <ChevronDown className="h-3.5 w-3.5 text-blue-400" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-600" />;
}

// ─── DataTable ─────────────────────────────────────────────────────────────────

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search…',
  loading = false,
  emptyMessage = 'No results found.',
  emptyIcon,
  pageSize = 10,
  className = '',
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Filter
  const filtered = useMemo(
    () => data.filter((row) => rowMatchesSearch(row, query)),
    [data, query],
  );

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = String(getNestedValue(a, sortKey) ?? '');
      const bv = String(getNestedValue(b, sortKey) ?? '');
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
      setPage(1);
    },
    [sortKey],
  );

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setPage(1);
  }, []);

  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={`flex flex-col gap-0 rounded-xl border border-slate-700/50 bg-slate-900 overflow-hidden ${className}`}>
      {/* Search bar */}
      {searchable && (
        <div className="border-b border-slate-700/50 px-4 py-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={handleSearch}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-700/50 bg-slate-800 py-1.5 pl-9 pr-3
                text-sm text-slate-200 placeholder-slate-500 outline-none
                focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3 font-medium text-slate-400 ${alignClass(col.align)} ${
                    col.sortable ? 'cursor-pointer select-none hover:text-slate-200 transition-colors' : ''
                  }`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon
                        direction={sortKey === col.key ? sortDir : null}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <SkeletonRows cols={columns.length} />
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyMessage}
                    description={
                      query ? `No results match "${query}". Try adjusting your search.` : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`transition-colors ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-slate-800/60 active:bg-slate-800'
                      : 'hover:bg-slate-800/30'
                  }`}
                >
                  {columns.map((col) => {
                    const raw = getNestedValue(row, col.key);
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-slate-300 ${alignClass(col.align)} ${
                          col.mono ? 'font-mono text-xs' : ''
                        }`}
                      >
                        {col.render ? col.render(raw, row) : String(raw ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
          <span className="text-xs text-slate-500">
            Showing{' '}
            <span className="text-slate-300 font-medium">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)}
            </span>{' '}
            of <span className="text-slate-300 font-medium">{sorted.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/50
                text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200
                disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
              )
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-600">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium
                      transition-colors ${
                        page === p
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                  >
                    {p}
                  </button>
                ),
              )}

            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700/50
                text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200
                disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
