'use client'

import {
  ShieldCheck,
  Clock,
  Database,
  Hash,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Server,
  ChevronRight,
} from 'lucide-react'
import type { Evidence } from '@/lib/types'
import {
  cn,
  formatTimestamp,
  formatRelativeTime,
  formatBytes,
  truncateMiddle,
} from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface EvidenceCardProps {
  evidence: Evidence
  compact?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Integrity = 'verified' | 'pending' | 'failed'

function IntegrityBadge({ integrity }: { integrity: Integrity }) {
  const configs = {
    verified: {
      icon: <CheckCircle2 size={12} />,
      label: 'Verified',
      className:
        'bg-green-500/10 text-green-400 border-green-500/30',
    },
    pending: {
      icon: <AlertCircle size={12} />,
      label: 'Pending',
      className:
        'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    },
    failed: {
      icon: <XCircle size={12} />,
      label: 'Failed',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
    },
  }

  const cfg = configs[integrity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border',
        cfg.className
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function EvidenceTypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase()
  if (t.includes('pcap') || t.includes('capture'))
    return <Database size={13} className="text-blue-400" />
  if (t.includes('log'))
    return <FileText size={13} className="text-slate-400" />
  if (t.includes('screenshot'))
    return <FileText size={13} className="text-purple-400" />
  return <ShieldCheck size={13} className="text-slate-400" />
}

function EvidenceTypeBadge({ type }: { type: string }) {
  const t = type.toLowerCase()
  let colors = 'bg-slate-800 text-slate-400 border-slate-700/40'

  if (t.includes('pcap') || t.includes('capture'))
    colors = 'bg-blue-500/10 text-blue-400 border-blue-500/25'
  else if (t.includes('flow'))
    colors = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
  else if (t.includes('log'))
    colors = 'bg-slate-700/60 text-slate-300 border-slate-600/40'
  else if (t.includes('screenshot'))
    colors = 'bg-purple-500/10 text-purple-400 border-purple-500/25'

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
        colors
      )}
    >
      {type.replace('_', ' ')}
    </span>
  )
}

// Format a metadata value for display
function MetaValue({ value }: { value: string | number }) {
  if (typeof value === 'number') {
    // Heuristic: if large, try bytes
    if (value > 1000) return <span>{formatBytes(value)}</span>
    return <span>{value.toLocaleString()}</span>
  }
  return <span>{value}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EvidenceCard({ evidence, compact = false }: EvidenceCardProps) {
  const integrityFailed = evidence.integrity === 'failed'
  const integrityVerified = evidence.integrity === 'verified'

  // Pick up to 4 interesting metadata keys (prefer known ones)
  const PRIORITY_KEYS = ['file_size', 'fileSize', 'size', 'encoding', 'format', 'version', 'source_type']
  const metaEntries = Object.entries(evidence.metadata).filter(([, v]) => v !== '' && v !== undefined)
  const prioritized = [
    ...metaEntries.filter(([k]) => PRIORITY_KEYS.includes(k)),
    ...metaEntries.filter(([k]) => !PRIORITY_KEYS.includes(k)),
  ].slice(0, compact ? 2 : 4)

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-all duration-150',
        'bg-slate-900 border-slate-700/50',
        integrityFailed && 'border-red-500/25 bg-red-500/[0.03]',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header */}
      <div className={cn('flex items-start gap-2.5', compact ? 'mb-2' : 'mb-3')}>
        <div className="flex-shrink-0 mt-0.5">
          <EvidenceTypeIcon type={evidence.type} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <EvidenceTypeBadge type={evidence.type} />
            <IntegrityBadge integrity={evidence.integrity} />
            <span className="font-mono text-[10px] text-slate-500 tracking-tight ml-auto">
              {evidence.id}
            </span>
          </div>

          {/* Source */}
          <div className="flex items-center gap-1.5">
            <Server size={10} className="text-slate-600 flex-shrink-0" />
            <span className="text-[10px] text-slate-500">Source</span>
            <span className="text-[10px] text-slate-300 font-mono">{evidence.source}</span>
          </div>
        </div>
      </div>

      {/* Hash */}
      <div
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1.5 mb-2.5',
          integrityVerified
            ? 'bg-green-500/5 border border-green-500/15'
            : integrityFailed
            ? 'bg-red-500/5 border border-red-500/15'
            : 'bg-slate-800/60 border border-slate-700/30'
        )}
      >
        <Hash size={10} className={cn(
          'flex-shrink-0',
          integrityVerified ? 'text-green-500' : integrityFailed ? 'text-red-500' : 'text-slate-500'
        )} />
        <span className="text-[9px] text-slate-600 flex-shrink-0">SHA-256</span>
        <span
          className="font-mono text-[10px] text-slate-400 tracking-tight"
          title={evidence.hash}
        >
          {truncateMiddle(evidence.hash, compact ? 18 : 28)}
        </span>
        {integrityVerified && (
          <CheckCircle2 size={10} className="text-green-400 ml-auto flex-shrink-0" />
        )}
        {integrityFailed && (
          <XCircle size={10} className="text-red-400 ml-auto flex-shrink-0" />
        )}
      </div>

      {/* Metadata fields */}
      {!compact && metaEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-2.5 bg-slate-800/30 rounded p-2 border border-slate-700/20">
          {prioritized.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-[9px] text-slate-600 capitalize truncate">
                {key.replace(/([A-Z])/g, ' $1').replace('_', ' ')}
              </span>
              <span className="font-mono text-[10px] text-slate-400 truncate">
                <MetaValue value={value} />
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Analysis pipeline version */}
      {evidence.analysisVersion && !compact && (
        <div className="flex items-center gap-1.5 mb-2.5">
          <span className="text-[9px] text-slate-600">Analysis pipeline</span>
          <span className="font-mono text-[9px] text-slate-700">v{evidence.analysisVersion}</span>
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <Clock size={9} className="text-slate-600 flex-shrink-0" />
        <span>
          Collected{' '}
          <span className="font-mono text-slate-400">
            {formatTimestamp(evidence.timestamp, compact ? 'short' : 'human')}
          </span>
        </span>
        <span className="ml-auto text-slate-600 italic">
          {formatRelativeTime(evidence.timestamp)}
        </span>
      </div>
    </div>
  )
}

export default EvidenceCard
