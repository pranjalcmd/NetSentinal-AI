/**
 * NetSentinal AI — Utility Functions
 *
 * A collection of pure, stateless utility helpers used across the platform UI.
 * All functions are tree-shakeable named exports.
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { FindingSeverity, TriggerSeverity, HealthComponentStatus } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Tailwind / Class utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges Tailwind CSS class names with conditional support.
 * Combines clsx (conditional classes) with tailwind-merge (deduplication).
 *
 * @example cn('px-4 py-2', isActive && 'bg-blue-600', 'hover:bg-blue-500')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─────────────────────────────────────────────────────────────────────────────
// Byte / size formatting
// ─────────────────────────────────────────────────────────────────────────────

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

/**
 * Formats a byte count into a human-readable size string.
 *
 * @param bytes    - Raw byte count.
 * @param decimals - Number of decimal places (default: 2).
 *
 * @example
 * formatBytes(717225984)  // '684 MB'
 * formatBytes(1975308288) // '1.84 GB'
 * formatBytes(0)          // '0 B'
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B'
  if (!isFinite(bytes) || bytes < 0) return '—'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const clamped = Math.min(i, BYTE_UNITS.length - 1)
  const value = bytes / Math.pow(k, clamped)

  // Strip unnecessary trailing zeros for whole numbers
  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(dm)
  return `${formatted} ${BYTE_UNITS[clamped]}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Duration formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a duration in seconds into a short human-readable string.
 *
 * @example
 * formatDuration(2498)  // '41m 38s'
 * formatDuration(8062)  // '2h 14m 22s'
 * formatDuration(45)    // '45s'
 * formatDuration(3600)  // '1h 0m'
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '—'
  const s = Math.floor(seconds)
  if (s === 0) return '0s'

  const hours   = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs    = s % 60

  const parts: string[] = []
  if (hours   > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  // Show seconds only if duration < 1 hour (avoids '2h 14m 22s' verbosity)
  if (secs > 0 && hours === 0) parts.push(`${secs}s`)

  return parts.join(' ') || '0s'
}

/**
 * Formats a duration in milliseconds into a short human-readable string.
 *
 * @example formatDurationMs(2498000) // '41m 38s'
 */
export function formatDurationMs(milliseconds: number): string {
  return formatDuration(milliseconds / 1000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Relative time formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string (e.g. "12 seconds ago").
 *
 * @param date - A Date object, ISO 8601 string, or Unix timestamp (ms).
 *
 * @example
 * formatRelativeTime(new Date())                    // 'just now'
 * formatRelativeTime('2026-09-17T10:47:00Z')        // '4 minutes ago'
 * formatRelativeTime('2026-09-16T10:00:00Z')        // '1 day ago'
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 5)   return 'just now'
  if (diffSec < 60)  return `${diffSec} seconds ago`

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60)  return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24)   return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30)  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`

  const diffMo = Math.floor(diffDay / 30)
  if (diffMo < 12)   return `${diffMo} month${diffMo !== 1 ? 's' : ''} ago`

  const diffYr = Math.floor(diffMo / 12)
  return `${diffYr} year${diffYr !== 1 ? 's' : ''} ago`
}

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp formatting
// ─────────────────────────────────────────────────────────────────────────────

export type TimestampFormat = 'iso' | 'human' | 'short' | 'time-only' | 'date-only'

/**
 * Formats a date/timestamp into various display formats.
 *
 * @param date   - A Date object, ISO 8601 string, or Unix timestamp (ms).
 * @param format - Output format variant (default: 'human').
 *
 * @example
 * formatTimestamp('2026-09-16T14:31:04Z', 'human')     // 'Sep 16, 2026 14:31:04'
 * formatTimestamp('2026-09-16T14:31:04Z', 'iso')        // '2026-09-16T14:31:04Z'
 * formatTimestamp('2026-09-16T14:31:04Z', 'time-only')  // '14:31:04'
 * formatTimestamp('2026-09-16T14:31:04Z', 'date-only')  // 'Sep 16, 2026'
 * formatTimestamp('2026-09-16T14:31:04Z', 'short')      // '09/16 14:31'
 */
export function formatTimestamp(
  date: Date | string | number,
  format: TimestampFormat = 'human'
): string {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return '—'

  switch (format) {
    case 'iso':
      return d.toISOString()

    case 'time-only':
      return d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
      })

    case 'date-only':
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })

    case 'short':
      return (
        d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', timeZone: 'UTC' }) +
        ' ' +
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
      )

    case 'human':
    default:
      return (
        d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        }) +
        ' ' +
        d.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'UTC',
        })
      )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk / Severity colors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns CSS color hex or class based on a 0–100 risk score.
 * Critical: #E8483A | High: #E8863A | Medium: #E8C93A | Low: #4B7BE5
 */
export function riskColor(score: number): string {
  if (score >= 80) return 'text-[#E8483A]'
  if (score >= 60) return 'text-[#E8863A]'
  if (score >= 40) return 'text-[#E8C93A]'
  if (score >= 20) return 'text-[#4B7BE5]'
  return 'text-[#768396]'
}

export function riskHex(score: number): string {
  if (score >= 80) return '#E8483A'
  if (score >= 60) return '#E8863A'
  if (score >= 40) return '#E8C93A'
  if (score >= 20) return '#4B7BE5'
  return '#768396'
}

/**
 * Returns a Tailwind CSS background color class based on a 0–100 risk score.
 */
export function riskBgColor(score: number): string {
  if (score >= 80) return 'bg-[#E8483A]/10 border-[#E8483A]/30 text-[#E8483A]'
  if (score >= 60) return 'bg-[#E8863A]/10 border-[#E8863A]/30 text-[#E8863A]'
  if (score >= 40) return 'bg-[#E8C93A]/10 border-[#E8C93A]/30 text-[#E8C93A]'
  if (score >= 20) return 'bg-[#4B7BE5]/10 border-[#4B7BE5]/30 text-[#4B7BE5]'
  return 'bg-[#131A24] border-[#242B36] text-[#768396]'
}

/**
 * Returns a human-readable risk label for a 0–100 score.
 */
export function riskLabel(score: number): string {
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Medium'
  if (score >= 20) return 'Low'
  return 'None'
}

/**
 * Returns Tailwind CSS color classes for a finding/trigger severity level.
 * Severity colors: #E8483A critical, #E8863A high, #E8C93A medium, #4B7BE5 low
 */
export function severityColor(severity: FindingSeverity | TriggerSeverity | string): string {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'text-[#E8483A]'
    case 'high':     return 'text-[#E8863A]'
    case 'medium':   return 'text-[#E8C93A]'
    case 'low':      return 'text-[#4B7BE5]'
    case 'info':     return 'text-[#3DD9C4]'
    default:         return 'text-[#768396]'
  }
}

/**
 * Returns Tailwind CSS badge color classes for a finding/trigger severity level.
 */
export function severityBadgeColor(severity: FindingSeverity | TriggerSeverity | string): string {
  switch (severity?.toLowerCase()) {
    case 'critical': return 'bg-[#E8483A]/10 text-[#E8483A] border-[#E8483A]/30'
    case 'high':     return 'bg-[#E8863A]/10 text-[#E8863A] border-[#E8863A]/30'
    case 'medium':   return 'bg-[#E8C93A]/10 text-[#E8C93A] border-[#E8C93A]/30'
    case 'low':      return 'bg-[#4B7BE5]/10 text-[#4B7BE5] border-[#4B7BE5]/30'
    case 'info':     return 'bg-[#3DD9C4]/10 text-[#3DD9C4] border-[#3DD9C4]/30'
    default:         return 'bg-[#131A24] text-[#768396] border-[#242B36]'
  }
}

/**
 * Returns Tailwind CSS color classes for various entity status strings.
 * Handles sensor status, capture status, incident status, and more.
 *
 * @example statusColor('online')    // 'text-green-400'
 * @example statusColor('degraded')  // 'text-yellow-500'
 * @example statusColor('ANALYZED')  // 'text-blue-400'
 */
export function statusColor(status: string): string {
  const s = status.toLowerCase()
  switch (s) {
    // Sensor status
    case 'online':            return 'text-green-400'
    case 'degraded':          return 'text-yellow-500'
    case 'offline':           return 'text-red-500'

    // Capture status
    case 'ready':             return 'text-green-400'
    case 'analyzed':          return 'text-blue-400'
    case 'buffering':         return 'text-slate-400'
    case 'recording':         return 'text-red-400'
    case 'finalizing':        return 'text-yellow-400'
    case 'uploading':         return 'text-blue-400'
    case 'failed':            return 'text-red-500'

    // Trigger status
    case 'active':            return 'text-red-400'
    case 'preserved':         return 'text-green-400'
    case 'preserving':        return 'text-yellow-400'
    case 'preservation_requested': return 'text-orange-400'
    case 'dismissed':         return 'text-slate-500'

    // Finding status
    case 'open':              return 'text-orange-400'
    case 'confirmed':         return 'text-red-400'
    case 'benign':            return 'text-green-400'
    case 'needs_investigation': return 'text-yellow-400'
    case 'resolved':          return 'text-slate-400'

    // Incident status
    case 'investigating':     return 'text-orange-400'
    case 'contained':         return 'text-yellow-400'
    case 'closed':            return 'text-slate-500'

    // Investigation pipeline
    case 'queued':            return 'text-slate-400'
    case 'running':           return 'text-blue-400'
    case 'completed':         return 'text-green-400'
    case 'cancelled':         return 'text-slate-500'

    // Report status
    case 'draft':             return 'text-slate-400'
    case 'review':            return 'text-yellow-400'
    case 'final':             return 'text-green-400'
    case 'delivered':         return 'text-blue-400'

    // Health status
    case 'healthy':           return 'text-green-400'
    case 'down':              return 'text-red-500'
    case 'unknown':           return 'text-slate-500'

    default:                  return 'text-slate-400'
  }
}

/**
 * Returns Tailwind CSS badge classes for various status strings.
 */
export function statusBadgeColor(status: string): string {
  const s = status.toLowerCase()
  switch (s) {
    case 'online':
    case 'ready':
    case 'preserved':
    case 'healthy':
    case 'benign':
    case 'resolved':
    case 'completed':
    case 'final':
    case 'delivered':
      return 'bg-green-500/10 text-green-400 border-green-500/30'

    case 'degraded':
    case 'finalizing':
    case 'preservation_requested':
    case 'needs_investigation':
    case 'contained':
    case 'review':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'

    case 'recording':
    case 'active':
    case 'confirmed':
    case 'offline':
    case 'failed':
    case 'down':
      return 'bg-red-500/10 text-red-400 border-red-500/30'

    case 'analyzed':
    case 'uploading':
    case 'running':
    case 'delivered':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30'

    case 'open':
    case 'preserving':
    case 'investigating':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/30'

    default:
      return 'bg-slate-800 text-slate-400 border-slate-700/50'
  }
}

/**
 * Returns Tailwind CSS color class for a system health status.
 */
export function healthColor(status: HealthComponentStatus): string {
  switch (status) {
    case 'healthy':  return 'text-green-400'
    case 'degraded': return 'text-yellow-500'
    case 'down':     return 'text-red-500'
    case 'unknown':  return 'text-slate-500'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence labels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable confidence label from a decimal confidence value.
 *
 * @param confidence - Decimal value between 0.0 and 1.0.
 *
 * @example confidenceLabel(0.91) // 'Very High'
 * @example confidenceLabel(0.55) // 'Medium'
 */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.90) return 'Very High'
  if (confidence >= 0.75) return 'High'
  if (confidence >= 0.55) return 'Medium'
  if (confidence >= 0.35) return 'Low'
  return 'Very Low'
}

/**
 * Returns a Tailwind CSS color class for a confidence value.
 */
export function confidenceColor(confidence: number): string {
  if (confidence >= 0.90) return 'text-green-400'
  if (confidence >= 0.75) return 'text-green-300'
  if (confidence >= 0.55) return 'text-yellow-400'
  if (confidence >= 0.35) return 'text-orange-400'
  return 'text-red-400'
}

// ─────────────────────────────────────────────────────────────────────────────
// String utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncates a string to show the start and end, with ellipsis in the middle.
 * Useful for displaying SHA-256 hashes or long IDs.
 *
 * @param str    - The string to truncate.
 * @param maxLen - Maximum total visible characters (including the 3 dots). Default: 16.
 *
 * @example
 * truncateMiddle('a3f4b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4', 16)
 * // 'a3f4b2c1...e5f4'
 */
export function truncateMiddle(str: string, maxLen = 16): string {
  if (!str) return ''
  if (str.length <= maxLen) return str

  const keep = maxLen - 3  // 3 chars for '...'
  const front = Math.ceil(keep / 2)
  const back = Math.floor(keep / 2)
  return `${str.slice(0, front)}...${str.slice(str.length - back)}`
}

/**
 * Truncates a string at the end with an ellipsis.
 */
export function truncate(str: string, maxLen: number): string {
  if (!str) return ''
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/**
 * Generates a deterministic-looking ID with a given prefix.
 * Uses a counter + timestamp suffix to ensure uniqueness within a session.
 *
 * @param prefix - ID prefix (e.g. 'FLOW', 'EVT').
 *
 * @example generateId('FLOW') // 'FLOW-7f3a2b'
 */
let _idCounter = 0
export function generateId(prefix: string): string {
  _idCounter++
  const hex = (_idCounter * 0x9e3779b9 + 0x6b3a7c5d).toString(16).slice(-6)
  return `${prefix}-${hex}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Number formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a large number with k/M/B suffixes.
 *
 * @example formatNumber(18492)   // '18.5k'
 * @example formatNumber(1842000) // '1.84M'
 */
export function formatNumber(n: number, decimals = 1): string {
  if (!isFinite(n)) return '—'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(decimals)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(decimals)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(decimals)}k`
  return n.toFixed(0)
}

/**
 * Formats a packets-per-second or flows-per-second value.
 *
 * @example formatRate(18420) // '18.4k pps'
 */
export function formatRate(n: number, unit = 'pps'): string {
  return `${formatNumber(n)} ${unit}`
}

/**
 * Formats a percentage value.
 *
 * @example formatPercent(0.79)  // '79%'
 * @example formatPercent(79, false) // '79%'
 */
export function formatPercent(value: number, isDecimal = true): string {
  const pct = isDecimal ? value * 100 : value
  return `${Math.round(pct)}%`
}

/**
 * Clamps a number to [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// ─────────────────────────────────────────────────────────────────────────────
// IP address utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the IP is in a private (RFC 1918 / loopback) range.
 */
export function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false
  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

/**
 * Extracts the /24 CIDR prefix from an IP address.
 *
 * @example ipSubnet('10.0.0.14') // '10.0.0.0/24'
 */
export function ipSubnet(ip: string): string {
  const parts = ip.split('.')
  if (parts.length !== 4) return ip
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
}

// ─────────────────────────────────────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns `true` if the value is not null or undefined.
 * Useful as a type guard in filter chains.
 *
 * @example [null, 'a', undefined, 'b'].filter(isDefined) // ['a', 'b']
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Debounce: returns a debounced version of `fn` that delays invocation
 * by `delay` ms after the last call.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Groups an array of objects by a string key.
 *
 * @example groupBy(findings, f => f.severity)
 */
export function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item)
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}

/**
 * Sorts an array of objects by a numeric or string key.
 */
export function sortBy<T>(arr: T[], keyFn: (item: T) => string | number, dir: 'asc' | 'desc' = 'asc'): T[] {
  return [...arr].sort((a, b) => {
    const ka = keyFn(a)
    const kb = keyFn(b)
    const cmp = ka < kb ? -1 : ka > kb ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}

/**
 * Picks a subset of keys from an object.
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    result[key] = obj[key]
  }
  return result
}
