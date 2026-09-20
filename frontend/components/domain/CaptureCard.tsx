'use client'

import {
  FileStack,
  Clock,
  HardDrive,
  Hash,
  Radio,
  Link2,
  ChevronRight,
  CheckCircle2,
  Loader2,
  XCircle,
  Upload,
} from 'lucide-react'
import type { Capture, CaptureType, CaptureStatus } from '@/lib/types'
import {
  cn,
  formatBytes,
  formatDuration,
  formatTimestamp,
  formatRelativeTime,
  truncateMiddle,
} from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface CaptureCardProps {
  capture: Capture
  onClick?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function CaptureTypeBadge({ type }: { type: CaptureType }) {
  const configs: Record<
    CaptureType,
    { label: string; cssClass: string; description: string }
  > = {
    ROLLING: {
      label: 'ROLLING',
      cssClass: 'badge-rolling',
      description: 'Continuous ring buffer',
    },
    MANUAL: {
      label: 'MANUAL',
      cssClass: 'badge-manual',
      description: 'Consultant-requested',
    },
    AUTO_PRESERVED: {
      label: 'AUTO-PRESERVED',
      cssClass: 'badge-auto-preserved',
      description: 'Threshold-triggered preservation',
    },
    UPLOADED: {
      label: 'UPLOADED',
      cssClass: 'badge-uploaded',
      description: 'Externally uploaded file',
    },
    IMPORTED: {
      label: 'IMPORTED',
      cssClass: '',
      description: 'Imported from external system',
    },
  }

  const cfg = configs[type] ?? { label: type, cssClass: '', description: '' }

  return (
    <span
      title={cfg.description}
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider',
        cfg.cssClass,
        !cfg.cssClass && 'bg-slate-800 text-slate-400 border border-slate-700/50'
      )}
    >
      {cfg.label}
    </span>
  )
}

function StatusIcon({ status }: { status: CaptureStatus }) {
  switch (status) {
    case 'ANALYZED':
    case 'READY':
      return <CheckCircle2 size={13} className="text-green-400" />
    case 'RECORDING':
      return <div className="recording-dot" />
    case 'UPLOADING':
    case 'FINALIZING':
      return <Loader2 size={13} className="text-blue-400 animate-spin" />
    case 'FAILED':
      return <XCircle size={13} className="text-red-400" />
    case 'BUFFERING':
      return <Loader2 size={13} className="text-slate-500 animate-spin" />
    default:
      return <FileStack size={13} className="text-slate-500" />
  }
}

function StatusLabel({ status }: { status: CaptureStatus }) {
  const map: Record<CaptureStatus, { label: string; color: string }> = {
    BUFFERING:   { label: 'Buffering',   color: 'text-slate-400' },
    RECORDING:   { label: 'Recording',   color: 'text-red-400' },
    FINALIZING:  { label: 'Finalizing',  color: 'text-yellow-400' },
    READY:       { label: 'Ready',       color: 'text-green-400' },
    ANALYZED:    { label: 'Analyzed',    color: 'text-blue-400' },
    FAILED:      { label: 'Failed',      color: 'text-red-500' },
    UPLOADING:   { label: 'Uploading',   color: 'text-blue-400' },
  }
  const cfg = map[status] ?? { label: status, color: 'text-slate-400' }
  return (
    <span className={cn('text-[10px] font-semibold', cfg.color)}>
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CaptureCard({ capture, onClick }: CaptureCardProps) {
  const isRecording = capture.status === 'RECORDING'
  const isFailed = capture.status === 'FAILED'

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border transition-all duration-150 cursor-pointer p-4',
        'bg-slate-900 border-slate-700/50',
        isRecording && 'border-red-500/30 bg-red-500/[0.03]',
        isFailed && 'border-red-500/20',
        onClick && 'hover:border-slate-600 hover:bg-slate-800/80'
      )}
    >
      {/* Recording pulse strip */}
      {isRecording && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg bg-red-500 animate-pulse-live" />
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 mt-0.5">
          <StatusIcon status={capture.status} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <CaptureTypeBadge type={capture.type} />
            <StatusLabel status={capture.status} />

            {/* Capture ID */}
            <span className="font-mono text-[10px] text-slate-500 tracking-tight ml-auto">
              {capture.id}
            </span>
          </div>

          {/* Filename if available */}
          {capture.filename && (
            <div className="text-xs text-slate-300 font-mono truncate">
              {capture.filename}
            </div>
          )}
        </div>

        {onClick && (
          <ChevronRight
            size={14}
            className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5"
          />
        )}
      </div>

      {/* Sensor */}
      <div className="flex items-center gap-1.5 mb-2.5 pl-[26px]">
        <Radio size={11} className="text-slate-500 flex-shrink-0" />
        <span className="text-[10px] text-slate-500">Sensor</span>
        <span className="font-mono text-[10px] text-slate-300">{capture.sensorName}</span>
        <span className="text-[10px] text-slate-600">·</span>
        <span className="font-mono text-[9px] text-slate-600">{capture.sensorId}</span>
      </div>

      {/* Time range + duration */}
      <div className="flex items-center gap-3 mb-2.5 pl-[26px]">
        <Clock size={11} className="text-slate-500 flex-shrink-0" />
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>
            <span className="text-slate-600">Start </span>
            <span className="font-mono">{formatTimestamp(capture.startTime, 'short')}</span>
          </span>
          {capture.endTime && (
            <>
              <span className="text-slate-600">→</span>
              <span>
                <span className="text-slate-600">End </span>
                <span className="font-mono">{formatTimestamp(capture.endTime, 'short')}</span>
              </span>
            </>
          )}
          {capture.duration !== undefined && (
            <span className="ml-1 px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 border border-slate-700/40 font-mono">
              {formatDuration(capture.duration)}
            </span>
          )}
          {isRecording && (
            <span className="ml-1 text-red-400 font-semibold">● REC</span>
          )}
        </div>
      </div>

      {/* Size + protocol stats */}
      <div className="flex items-center gap-4 mb-2.5 pl-[26px]">
        {capture.sizeBytes !== undefined && (
          <div className="flex items-center gap-1.5">
            <HardDrive size={11} className="text-slate-500" />
            <span className="font-mono text-[10px] text-slate-300">
              {formatBytes(capture.sizeBytes)}
            </span>
          </div>
        )}

        {capture.metadata.packets !== undefined && (
          <div className="text-[10px] text-slate-500">
            <span className="text-slate-400 font-mono">
              {capture.metadata.packets.toLocaleString()}
            </span>{' '}
            pkts
          </div>
        )}

        {capture.metadata.flows !== undefined && (
          <div className="text-[10px] text-slate-500">
            <span className="text-slate-400 font-mono">
              {capture.metadata.flows.toLocaleString()}
            </span>{' '}
            flows
          </div>
        )}

        {capture.metadata.protocols.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap ml-auto">
            {capture.metadata.protocols.slice(0, 5).map((p) => (
              <span
                key={p}
                className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/40 font-mono"
              >
                {p}
              </span>
            ))}
            {capture.metadata.protocols.length > 5 && (
              <span className="text-[9px] text-slate-600">
                +{capture.metadata.protocols.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* SHA-256 */}
      {capture.sha256 && (
        <div className="flex items-center gap-1.5 mb-2.5 pl-[26px]">
          <Hash size={10} className="text-slate-600 flex-shrink-0" />
          <span className="text-[9px] text-slate-600">SHA-256</span>
          <span
            className="font-mono text-[10px] text-slate-500 tracking-tight"
            title={capture.sha256}
          >
            {truncateMiddle(capture.sha256, 24)}
          </span>
        </div>
      )}

      {/* Trigger links (AUTO_PRESERVED) */}
      {capture.type === 'AUTO_PRESERVED' && capture.triggerIds.length > 0 && (
        <div className="flex items-center gap-1.5 mb-2.5 pl-[26px] bg-orange-500/5 border border-orange-500/15 rounded px-2 py-1.5">
          <Link2 size={10} className="text-orange-400 flex-shrink-0" />
          <span className="text-[9px] text-orange-400/70">Trigger</span>
          {capture.triggerIds.slice(0, 2).map((tid) => (
            <span key={tid} className="font-mono text-[10px] text-orange-300">
              {tid}
            </span>
          ))}
          {capture.triggerIds.length > 2 && (
            <span className="text-[9px] text-orange-400/50">
              +{capture.triggerIds.length - 2} more
            </span>
          )}
        </div>
      )}

      {/* Upload info */}
      {capture.uploadedAt && (
        <div className="flex items-center gap-1.5 pl-[26px]">
          <Upload size={10} className="text-slate-600" />
          <span className="text-[9px] text-slate-600">
            Uploaded{' '}
            <span className="font-mono">{formatTimestamp(capture.uploadedAt, 'short')}</span>
          </span>
          {capture.analysisVersion && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[9px] text-slate-700 font-mono">
                engine v{capture.analysisVersion}
              </span>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      {!capture.uploadedAt && (
        <div className="flex items-center gap-2 pl-[26px] text-[10px] text-slate-600 mt-1">
          <span className="italic">{formatRelativeTime(capture.startTime)}</span>
          {capture.analysisVersion && (
            <>
              <span>·</span>
              <span className="font-mono text-slate-700">engine v{capture.analysisVersion}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default CaptureCard
