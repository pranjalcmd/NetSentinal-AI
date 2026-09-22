'use client';

import React from 'react';

// ─── Shared helpers ────────────────────────────────────────────────────────────

type Size = 'sm' | 'md';

function sizeClasses(size: Size): string {
  return size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 gap-1'
    : 'text-xs px-2 py-1 gap-1.5';
}

function dotSize(size: Size): string {
  return size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
}

// ─── RiskBadge ─────────────────────────────────────────────────────────────────

export interface RiskBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: Size;
}

interface RiskLevel {
  label: string;
  classes: string;
  dot: string;
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 85)
    return {
      label: 'Critical',
      classes: 'bg-red-500/20 text-red-400 border border-red-500/30',
      dot: 'bg-red-500',
    };
  if (score >= 65)
    return {
      label: 'High',
      classes: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
      dot: 'bg-orange-500',
    };
  if (score >= 40)
    return {
      label: 'Medium',
      classes: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      dot: 'bg-yellow-500',
    };
  return {
    label: 'Low',
    classes: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    dot: 'bg-blue-500',
  };
}

export function RiskBadge({ score, showLabel = true, size = 'md' }: RiskBadgeProps) {
  const { label, classes, dot } = getRiskLevel(score);
  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-semibold ${classes} ${sizeClasses(size)}`}
    >
      <span className={`rounded-full flex-shrink-0 ${dotSize(size)} ${dot}`} />
      <span>{score}</span>
      {showLabel && <span className="opacity-75">· {label}</span>}
    </span>
  );
}

// ─── ConfidenceBadge ───────────────────────────────────────────────────────────

export interface ConfidenceBadgeProps {
  confidence: number;
  size?: Size;
}

function getConfidenceLabel(c: number): string {
  if (c > 80) return 'High';
  if (c >= 50) return 'Medium';
  return 'Low';
}

export function ConfidenceBadge({ confidence, size = 'md' }: ConfidenceBadgeProps) {
  const label = getConfidenceLabel(confidence);
  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-semibold
        bg-teal-500/10 text-teal-300 border border-teal-500/20 ${sizeClasses(size)}`}
    >
      <span>{confidence}%</span>
      <span className="opacity-60">· {label}</span>
    </span>
  );
}

// ─── SeverityBadge ─────────────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SeverityBadgeProps {
  severity: Severity;
  size?: Size;
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  info: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold uppercase tracking-wide
        ${SEVERITY_STYLES[severity]} ${sizeClasses(size)}`}
    >
      {severity}
    </span>
  );
}

// ─── StatusBadge ───────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  status: string;
  size?: Size;
}

const GREEN_STATUSES = new Set([
  'online',
  'healthy',
  'active',
  'ready',
  'analyzed',
  'verified',
  'completed',
  'resolved',
  'confirmed',
]);
const YELLOW_STATUSES = new Set([
  'degraded',
  'recording',
  'investigating',
  'needs_investigation',
  'running',
  'buffering',
  'uploading',
]);
const RED_STATUSES = new Set(['offline', 'failed', 'critical']);
const SLATE_STATUSES = new Set(['benign', 'dismissed', 'closed', 'cancelled']);

function getStatusStyle(status: string): string {
  const key = status.toLowerCase();
  if (GREEN_STATUSES.has(key))
    return 'bg-green-500/15 text-green-400 border border-green-500/25';
  if (YELLOW_STATUSES.has(key))
    return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25';
  if (RED_STATUSES.has(key))
    return 'bg-red-500/15 text-red-400 border border-red-500/25';
  if (SLATE_STATUSES.has(key))
    return 'bg-slate-500/15 text-slate-400 border border-slate-500/25';
  // queued, pending, open, draft → blue-slate
  return 'bg-slate-700/40 text-slate-300 border border-slate-600/40';
}

function getStatusDot(status: string): string {
  const key = status.toLowerCase();
  if (GREEN_STATUSES.has(key)) return 'bg-green-500';
  if (YELLOW_STATUSES.has(key)) return 'bg-yellow-500';
  if (RED_STATUSES.has(key)) return 'bg-red-500';
  return 'bg-slate-500';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const label = status.replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium capitalize
        ${getStatusStyle(status)} ${sizeClasses(size)}`}
    >
      <span
        className={`rounded-full flex-shrink-0 ${dotSize(size)} ${getStatusDot(status)}`}
      />
      {label}
    </span>
  );
}

// ─── CaptureTypeBadge ──────────────────────────────────────────────────────────

export type CaptureType = 'ROLLING' | 'MANUAL' | 'AUTO_PRESERVED' | 'UPLOADED' | 'IMPORTED';

export interface CaptureTypeBadgeProps {
  type: CaptureType;
  size?: Size;
}

const CAPTURE_STYLES: Record<CaptureType, string> = {
  ROLLING: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25',
  MANUAL: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  AUTO_PRESERVED: 'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  UPLOADED: 'bg-green-500/15 text-green-400 border border-green-500/25',
  IMPORTED: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
};

const CAPTURE_LABELS: Record<CaptureType, string> = {
  ROLLING: 'Rolling',
  MANUAL: 'Manual',
  AUTO_PRESERVED: 'Auto Preserved',
  UPLOADED: 'Uploaded',
  IMPORTED: 'Imported',
};

export function CaptureTypeBadge({ type, size = 'md' }: CaptureTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium
        ${CAPTURE_STYLES[type]} ${sizeClasses(size)}`}
    >
      {CAPTURE_LABELS[type]}
    </span>
  );
}

// ─── LiveIndicator ─────────────────────────────────────────────────────────────

export interface LiveIndicatorProps {
  label?: string;
  size?: Size;
}

export function LiveIndicator({ label = 'LIVE', size = 'md' }: LiveIndicatorProps) {
  const dotCls = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  const textCls = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold tracking-widest uppercase text-red-400 ${textCls}`}
    >
      <span className="relative flex items-center justify-center">
        <span
          className={`absolute inline-flex rounded-full bg-red-500 opacity-75 animate-ping ${dotCls}`}
        />
        <span className={`relative inline-flex rounded-full bg-red-500 ${dotCls}`} />
      </span>
      {label}
    </span>
  );
}
