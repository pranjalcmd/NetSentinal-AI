'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'critical' | 'warning' | 'success';
  sublabel?: string;
  mono?: boolean;
}

// ─── Variant styles ────────────────────────────────────────────────────────────

const VARIANT_BORDER: Record<string, string> = {
  default:  'border-slate-700/50',
  critical: 'border-red-500/30',
  warning:  'border-yellow-500/30',
  success:  'border-green-500/30',
};

const VARIANT_ICON_BG: Record<string, string> = {
  default:  'bg-slate-700/50 text-slate-400',
  critical: 'bg-red-500/15 text-red-400',
  warning:  'bg-yellow-500/15 text-yellow-400',
  success:  'bg-green-500/15 text-green-400',
};

const VARIANT_VALUE: Record<string, string> = {
  default:  'text-slate-100',
  critical: 'text-red-400',
  warning:  'text-yellow-400',
  success:  'text-green-400',
};

// ─── Trend indicator ───────────────────────────────────────────────────────────

interface TrendProps {
  trend: 'up' | 'down' | 'stable';
  trendValue?: string;
}

function TrendIndicator({ trend, trendValue }: TrendProps) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-green-400 font-medium">
        <TrendingUp className="h-3 w-3" />
        {trendValue}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-red-400 font-medium">
        <TrendingDown className="h-3 w-3" />
        {trendValue}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-slate-400 font-medium">
      <Minus className="h-3 w-3" />
      {trendValue ?? 'Stable'}
    </span>
  );
}

// ─── MetricCard ────────────────────────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  icon,
  variant = 'default',
  sublabel,
  mono = true,
}: MetricCardProps) {
  const borderCls = VARIANT_BORDER[variant];
  const iconBgCls = VARIANT_ICON_BG[variant];
  const valueCls  = VARIANT_VALUE[variant];

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-xl border bg-slate-900 p-4
        transition-colors hover:bg-slate-800/60 ${borderCls}`}
    >
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between">
        {icon ? (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBgCls}`}
          >
            {icon}
          </span>
        ) : (
          <span />
        )}

        {trend && (
          <TrendIndicator trend={trend} trendValue={trendValue} />
        )}
      </div>

      {/* Value row */}
      <div className="flex items-end gap-1.5 leading-none">
        <span
          className={`text-2xl font-bold tracking-tight ${valueCls} ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="mb-0.5 text-sm font-medium text-slate-500">{unit}</span>
        )}
      </div>

      {/* Label + sublabel */}
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        {sublabel && (
          <span className="text-xs text-slate-500">{sublabel}</span>
        )}
      </div>

      {/* Accent bar for non-default variants */}
      {variant !== 'default' && (
        <span
          className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${
            variant === 'critical'
              ? 'bg-red-500'
              : variant === 'warning'
              ? 'bg-yellow-500'
              : 'bg-green-500'
          }`}
        />
      )}
    </div>
  );
}
