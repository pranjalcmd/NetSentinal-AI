import os

base_dir = "/Users/mdayansk/.gemini/antigravity/scratch/NetSentinal-AI/frontend"

files = {}

# 1. UI Primitives
files["components/ui/EmptyState.tsx"] = ''''use client';

import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
      <div className="p-3 bg-slate-800/60 rounded-full text-slate-400 mb-4">
        {icon || <Database className="w-8 h-8" />}
      </div>
      <h3 className="text-base font-semibold text-slate-200 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
'''

files["components/ui/Modal.tsx"] = ''''use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/40">{footer}</div>}
      </div>
    </div>
  );
}
'''

files["components/ui/Button.tsx"] = ''''use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60",
    danger: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20",
    outline: "border border-slate-700 hover:bg-slate-800 text-slate-300",
    ghost: "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5"
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
'''

files["components/ui/Card.tsx"] = ''''use client';

import React from 'react';

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-xl backdrop-blur-md ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between">{children}</div>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-100">{children}</h3>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-400 mt-0.5">{children}</p>;
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
'''

files["components/ui/Drawer.tsx"] = ''''use client';

import React from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slide-in-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
'''

files["components/ui/Skeleton.tsx"] = ''''use client';

import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800/80 ${className}`} />;
}
'''

# 2. Domain Badges
files["components/domain/RiskBadge.tsx"] = ''''use client';

import React from 'react';
import { riskColor, riskLabel } from '@/lib/utils';

export function RiskBadge({ score }: { score: number }) {
  const colorClass = riskColor(score);
  const label = riskLabel(score);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass} bg-slate-950/60 border border-current/20`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{score}</span>
      <span className="text-[10px] opacity-75">({label})</span>
    </span>
  );
}
'''

files["components/domain/ConfidenceBadge.tsx"] = ''''use client';

import React from 'react';

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  let color = "text-emerald-400 bg-emerald-950/40 border-emerald-500/30";
  if (confidence < 70) color = "text-amber-400 bg-amber-950/40 border-amber-500/30";
  if (confidence < 50) color = "text-slate-400 bg-slate-900 border-slate-700";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium border ${color}`}>
      <span>Conf:</span>
      <span>{confidence}%</span>
    </span>
  );
}
'''

files["components/domain/StatusBadge.tsx"] = ''''use client';

import React from 'react';

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let color = "bg-slate-800 text-slate-300 border-slate-700";
  if (['open', 'investigating', 'recording', 'active', 'degraded'].includes(s)) {
    color = "bg-amber-950/50 text-amber-400 border-amber-500/30";
  } else if (['critical', 'high', 'failed', 'offline'].includes(s)) {
    color = "bg-red-950/50 text-red-400 border-red-500/30";
  } else if (['resolved', 'ready', 'analyzed', 'verified', 'online', 'completed', 'confirmed'].includes(s)) {
    color = "bg-emerald-950/50 text-emerald-400 border-emerald-500/30";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider ${color}`}>
      {status}
    </span>
  );
}
'''

files["components/domain/SensorStatus.tsx"] = ''''use client';

import React from 'react';
import type { SensorStatus as StatusType } from '@/lib/types';

export function SensorStatus({ status }: { status: StatusType }) {
  const colors = {
    online: "bg-emerald-500 text-emerald-400",
    degraded: "bg-amber-500 text-amber-400",
    offline: "bg-red-500 text-red-400"
  };

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full animate-pulse ${colors[status].split(' ')[0]}`} />
      <span className={`capitalize ${colors[status].split(' ')[1]}`}>{status}</span>
    </span>
  );
}
'''

files["components/domain/CaptureEngineStatus.tsx"] = ''''use client';

import React from 'react';
import type { CaptureEngineStatus as EngineStatusType } from '@/lib/types';
import { Activity, ShieldCheck, RefreshCw } from 'lucide-react';

export function CaptureEngineStatus({ status }: { status: EngineStatusType }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs">
      <div className="flex items-center gap-1.5 text-slate-300">
        <Activity className="w-4 h-4 text-blue-400" />
        <span>Rolling: <strong className={status.rollingCapture ? "text-emerald-400" : "text-slate-500"}>{status.rollingCapture ? "ACTIVE (600s)" : "OFFLINE"}</strong></span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-300">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>Auto-Preserve: <strong className={status.autoPreservation ? "text-emerald-400" : "text-slate-500"}>{status.autoPreservation ? "ENABLED" : "DISABLED"}</strong></span>
      </div>
      {status.manualCapture && (
        <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
          <RefreshCw className="w-4 h-4 spin" />
          <span>Manual Capture In Progress</span>
        </div>
      )}
    </div>
  );
}
'''

# Write files to disk
for rel_path, content in files.items():
  full_path = os.path.join(base_dir, rel_path)
  os.makedirs(os.path.dirname(full_path), exist_ok=True)
  with open(full_path, 'w', encoding='utf-8') as f:
    f.write(content)
  print(f"Wrote {rel_path}")

