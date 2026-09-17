'use client'

import {
  ShieldAlert,
  Monitor,
  AlertTriangle,
  Clock,
  Radio,
  FileStack,
  ChevronRight,
  Activity,
} from 'lucide-react'
import type { Incident } from '@/lib/types'
import {
  cn,
  statusBadgeColor,
  riskColor,
  confidenceLabel,
  confidenceColor,
  formatTimestamp,
  formatRelativeTime,
  truncate,
} from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface IncidentCardProps {
  incident: Incident
  onClick?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'open'
      ? 'bg-red-500'
      : status === 'investigating'
      ? 'bg-orange-500'
      : status === 'contained'
      ? 'bg-yellow-500'
      : status === 'resolved'
      ? 'bg-green-500'
      : 'bg-slate-500'

  const glow =
    status === 'open' || status === 'investigating'
      ? { boxShadow: `0 0 6px currentColor` }
      : {}

  return <span className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', color)} style={glow} />
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function IncidentCard({ incident, onClick }: IncidentCardProps) {
  const isActive = incident.status === 'open' || incident.status === 'investigating'
  const isCritical = incident.riskScore >= 80

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border transition-all duration-150 cursor-pointer p-4',
        'bg-slate-900 border-slate-700/50',
        isCritical && isActive && 'border-red-500/35 bg-red-500/[0.04]',
        onClick && 'hover:border-slate-600 hover:bg-slate-800/80'
      )}
      style={{
        boxShadow: isCritical && isActive ? '0 0 0 1px rgba(239,68,68,0.1)' : undefined,
      }}
    >
      {/* Accent stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg"
        style={{
          background:
            incident.status === 'open'
              ? '#ef4444'
              : incident.status === 'investigating'
              ? '#f97316'
              : incident.status === 'contained'
              ? '#eab308'
              : incident.status === 'resolved'
              ? '#22c55e'
              : '#475569',
        }}
      />

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <ShieldAlert
          size={16}
          className={cn(
            'flex-shrink-0 mt-0.5',
            isCritical ? 'text-red-400' : 'text-orange-400'
          )}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {/* Status badge */}
            <div className="flex items-center gap-1.5">
              <StatusDot status={incident.status} />
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border',
                  statusBadgeColor(incident.status)
                )}
              >
                {incident.status}
              </span>
            </div>

            {/* ID */}
            <span className="font-mono text-[10px] text-slate-500 tracking-tight">
              {incident.id}
            </span>

            {/* Live badge for active incidents */}
            {isActive && (
              <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-1.5 py-0.5 rounded tracking-wider">
                <Activity size={8} className="animate-pulse" />
                ACTIVE
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-slate-100 leading-tight">
            {truncate(incident.title, 90)}
          </h3>
        </div>

        {onClick && (
          <ChevronRight
            size={14}
            className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5"
          />
        )}
      </div>

      {/* Description */}
      {incident.description && (
        <p className="text-xs text-slate-400 leading-relaxed mb-3 pl-[28px]">
          {truncate(incident.description, 180)}
        </p>
      )}

      {/* Risk + Confidence */}
      <div className="flex items-center gap-4 mb-3 pl-[28px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-medium">Risk</span>
          <span className={cn('font-mono text-sm font-bold tabular-nums', riskColor(incident.riskScore))}>
            {incident.riskScore}
          </span>
          <span className="text-[9px] text-slate-600">/100</span>
        </div>

        <div className="w-px h-3.5 bg-slate-700/60" />

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-medium">Confidence</span>
          <span className={cn('text-xs font-semibold', confidenceColor(incident.confidence))}>
            {confidenceLabel(incident.confidence)}
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            ({Math.round(incident.confidence * 100)}%)
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-5 mb-3 pl-[28px]">
        {/* Affected hosts */}
        <div className="flex items-center gap-1.5">
          <Monitor size={11} className="text-slate-500" />
          <span className="text-[10px] text-slate-400">
            {incident.hostIds.length} host{incident.hostIds.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Findings */}
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={11} className="text-slate-500" />
          <span className="text-[10px] text-slate-400">
            {incident.findingIds.length} finding{incident.findingIds.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Captures */}
        {incident.captureIds.length > 0 && (
          <div className="flex items-center gap-1.5">
            <FileStack size={11} className="text-slate-500" />
            <span className="text-[10px] text-slate-400">
              {incident.captureIds.length} capture{incident.captureIds.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Sensors */}
        {incident.sensorIds.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Radio size={11} className="text-slate-500" />
            <span className="text-[10px] text-slate-400">
              {incident.sensorIds.length} sensor{incident.sensorIds.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Sensor + Capture refs (if single items) */}
      {(incident.sensorIds.length === 1 || incident.captureIds.length === 1) && (
        <div className="flex items-center gap-3 mb-3 pl-[28px]">
          {incident.sensorIds.length === 1 && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Radio size={9} />
              <span className="font-mono">{incident.sensorIds[0]}</span>
            </div>
          )}
          {incident.captureIds.length === 1 && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <FileStack size={9} />
              <span className="font-mono">{incident.captureIds[0]}</span>
            </div>
          )}
        </div>
      )}

      {/* Time range */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 pl-[28px]">
        <Clock size={9} className="flex-shrink-0 text-slate-600" />
        <span>
          First:{' '}
          <span className="font-mono text-slate-400">
            {formatTimestamp(incident.firstSeen, 'short')}
          </span>
        </span>
        <span>·</span>
        <span>
          Last:{' '}
          <span className="font-mono text-slate-400">
            {formatTimestamp(incident.lastSeen, 'short')}
          </span>
        </span>
        <span className="ml-auto text-slate-600 italic">
          {formatRelativeTime(incident.lastSeen)}
        </span>
      </div>
    </div>
  )
}

export default IncidentCard
