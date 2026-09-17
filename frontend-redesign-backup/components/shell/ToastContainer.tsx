'use client';

import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { Toast, ToastVariant } from './AppShell';

// ─────────────────────────────────────────────────────────────────────────────
// Variant config
// ─────────────────────────────────────────────────────────────────────────────

interface VariantConfig {
  color: string;
  borderColor: string;
  icon: React.ReactNode;
}

function getVariantConfig(variant: ToastVariant): VariantConfig {
  switch (variant) {
    case 'success':
      return {
        color: 'var(--status-online)',
        borderColor: 'rgba(34, 197, 94, 0.25)',
        icon: <CheckCircle size={15} />,
      };
    case 'warning':
      return {
        color: 'var(--risk-high)',
        borderColor: 'rgba(249, 115, 22, 0.25)',
        icon: <AlertTriangle size={15} />,
      };
    case 'error':
      return {
        color: 'var(--risk-critical)',
        borderColor: 'rgba(239, 68, 68, 0.25)',
        icon: <XCircle size={15} />,
      };
    case 'info':
    default:
      return {
        color: 'var(--accent-blue)',
        borderColor: 'var(--accent-blue-border)',
        icon: <Info size={15} />,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single Toast item
// ─────────────────────────────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { color, borderColor, icon } = getVariantConfig(toast.variant);

  return (
    <div
      className="toast"
      role="alert"
      aria-live="polite"
      style={{
        borderColor,
        borderLeftColor: color,
        borderLeftWidth: '3px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Icon */}
        <span style={{ color, flexShrink: 0, marginTop: '1px' }}>{icon}</span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: toast.message ? '3px' : 0,
            }}
          >
            {toast.title}
          </div>
          {toast.message && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              {toast.message}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '2px',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'color 0.12s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast container
// ─────────────────────────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
