'use client'

import { AlertTriangle, Clock, Monitor, Globe, Tag, ChevronRight } from 'lucide-react'
import type { Finding } from '@/lib/types'
import {
  cn,
  severityBadgeColor,
  statusBadgeColor,
  confidenceLabel,
  confidenceColor,
  riskColor,
  formatTimestamp,
  formatRelativeTime,
  truncate,
} from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface FindingCardProps {
  finding: Finding
  onClick?: () => void
  compact?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    beaconing: 'Beaconing',
    dns_tunneling: 'DNS Tunneling',
    data_exfiltration: 'Data Exfiltration',
    lateral_movement: 'Lateral Movement',
    port_scan: 'Port Scan',
    unusual_protocol: 'Unusual Protocol',
    new_destination: 'New Destination',
    volume_anomaly: 'Volume Anomaly',
    rare_port: 'Rare Port',
    other: 'Other',
  }
  return map[cat] ?? cat
}

function severityIcon(severity: string) {
  const color =
    severity === 'critical'
      ? '#ef4444'
      : severity === 'high'
      ? '#f97316'
      : severity === 'medium'
      ? '#eab308'
      : '#3b82f6'
  return <AlertTriangle size={14} color={color} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function FindingCard({ finding, onClick, compact = false }: FindingCardProps) {
  const isCritical = finding.severity === 'critical'
  const isHighRisk = finding.riskScore >= 80

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border transition-all duration-150 cursor-pointer',
        'bg-slate-900 border-slate-700/50',
        isCritical && 'border-red-500/30 bg-red-500/5',
        !isCritical && isHighRisk && 'border-orange-500/25 bg-orange-500/5',
        onClick && 'hover:border-slate-600 hover:bg-slate-800/80',
        compact ? 'p-3' : 'p-4'
      )}
      style={{
        boxShadow: isHighRisk
          ? `0 0 0 1px ${isCritical ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.1)'}`
          : undefined,
      }}
    >
      {/* Severity left border accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg"
        style={{
          background:
            finding.severity === 'critical'
              ? '#ef4444'
              : finding.severity === 'high'
              ? '#f97316'
              : finding.severity === 'medium'
              ? '#eab308'
              : finding.severity === 'low'
              ? '#22c55e'
              : '#3b82f6',
        }}
      />

      {/* Header row */}
      <div className={cn('flex items-start gap-3', compact ? 'mb-2' : 'mb-3')}>
        <div className="flex-shrink-0 mt-0.5">{severityIcon(finding.severity)}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {/* Severity badge */}
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                severityBadgeColor(finding.severity)
              )}
            >
              {finding.severity}
            </span>

            {/* Status badge */}
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                statusBadgeColor(finding.status)
              )}
            >
              {finding.status.replace('_', ' ')}
            </span>

            {/* ID */}
            <span className="font-mono text-[10px] text-slate-500 ml-auto tracking-tight">
              {finding.id}
            </span>
          </div>

          {/* Title */}
          <h3 className={cn('font-semibold text-slate-100 leading-tight', compact ? 'text-xs' : 'text-sm')}>
            {compact ? truncate(finding.title, 72) : finding.title}
          </h3>
        </div>

        {/* Chevron */}
        {onClick && (
          <ChevronRight
            size={14}
            className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5"
          />
        )}
      </div>

      {/* Description — hidden in compact */}
      {!compact && finding.description && (
        <p className="text-xs text-slate-400 leading-relaxed mb-3 pl-[26px]">
          {truncate(finding.description, 180)}
        </p>
      )}

      {/* Scores row */}
      <div className={cn('flex items-center gap-4', compact ? 'mb-2 pl-0' : 'mb-3 pl-[26px]')}>
        {/* Risk score */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-medium">Risk</span>
          <span
            className={cn('font-mono text-sm font-bold tabular-nums', riskColor(finding.riskScore))}
          >
            {finding.riskScore}
          </span>
          <span className="text-[9px] text-slate-600">/100</span>
        </div>

        <div className="w-px h-3.5 bg-slate-700/60" />

        {/* Confidence */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-medium">Confidence</span>
          <span className={cn('text-xs font-semibold', confidenceColor(finding.confidence))}>
            {confidenceLabel(finding.confidence)}
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            ({Math.round(finding.confidence * 100)}%)
          </span>
        </div>

        {/* Category badge */}
        <div className="ml-auto flex items-center gap-1">
          <Tag size={9} className="text-slate-600" />
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/40">
            {categoryLabel(finding.category)}
          </span>
        </div>
      </div>

      {/* Affected hosts + destinations — hidden in compact */}
      {!compact && (
        <div className="flex items-center gap-4 mb-3 pl-[26px]">
          {finding.hostIds.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Monitor size={11} className="text-slate-500" />
              <span className="text-[10px] text-slate-400">
                {finding.hostIds.length} host{finding.hostIds.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {finding.destinationIds.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Globe size={11} className="text-slate-500" />
              <span className="text-[10px] text-slate-400">
                {finding.destinationIds.length} destination{finding.destinationIds.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          {finding.flowIds.length > 0 && (
            <span className="text-[10px] text-slate-500">
              {finding.flowIds.length} flow records
            </span>
          )}
        </div>
      )}

      {/* Time range */}
      <div
        className={cn(
          'flex items-center gap-3 text-[10px] text-slate-500',
          compact ? '' : 'pl-[26px]'
        )}
      >
        <Clock size={9} className="flex-shrink-0 text-slate-600" />
        <span>
          First:{' '}
          <span className="font-mono text-slate-400">
            {formatTimestamp(finding.firstSeen, 'short')}
          </span>
        </span>
        <span>·</span>
        <span>
          Last:{' '}
          <span className="font-mono text-slate-400">
            {formatTimestamp(finding.lastSeen, 'short')}
          </span>
        </span>
        <span className="ml-auto text-slate-600 italic">
          {formatRelativeTime(finding.lastSeen)}
        </span>
      </div>
    </div>
  )
}

export default FindingCard
