'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AppNotification, Customer, Engagement, ConsultantContext } from '@/lib/types';
import {
  MOCK_CUSTOMER,
  MOCK_ENGAGEMENT,
  MOCK_CONSULTANT,
  MOCK_NOTIFICATIONS,
} from '@/lib/mock';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from './ToastContainer';
import { CommandPalette } from './CommandPalette';
import { AICopilotWidget } from '../ai/AICopilotWidget';
import { useBackendStatus } from '@/lib/useApi';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  durationMs?: number;
}

export interface AppContextValue {
  customer: Customer;
  engagement: Engagement;
  consultant: ConsultantContext;
  notifications: AppNotification[];
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

export const AppContext = createContext<AppContextValue>({
  customer: MOCK_CUSTOMER,
  engagement: MOCK_ENGAGEMENT,
  consultant: MOCK_CONSULTANT,
  notifications: MOCK_NOTIFICATIONS,
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
  commandPaletteOpen: false,
  setCommandPaletteOpen: () => {},
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
});

export function useAppContext(): AppContextValue {
  return useContext(AppContext);
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = toast.durationMs ?? 5000;

      setToasts((prev) => {
        const next = prev.length >= 5 ? prev.slice(1) : prev;
        return [...next, { ...toast, id }];
      });

      const timer = setTimeout(() => removeToast(id), duration);
      toastTimersRef.current.set(id, timer);
    },
    [removeToast],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const backend = useBackendStatus();

  const contextValue: AppContextValue = {
    customer: MOCK_CUSTOMER,
    engagement: MOCK_ENGAGEMENT,
    consultant: MOCK_CONSULTANT,
    notifications: MOCK_NOTIFICATIONS,
    toasts,
    addToast,
    removeToast,
    commandPaletteOpen,
    setCommandPaletteOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen bg-[#0A0E14] text-[#E4E8EE] overflow-hidden">
        {/* Persistent Left Sidebar */}
        <Sidebar />

        {/* Main Workstation View */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar with Breadcrumbs & Live Connection Status */}
          <Topbar />

          {/* With the API down each page falls back to the bundled sample
              capture. Saying so is the difference between a demo and a lie. */}
          {backend.online === false && (
            <div
              role="status"
              className="px-4 py-2 text-[11px] font-mono text-amber-300 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              Backend unreachable — every figure below is bundled sample data, not this environment.
            </div>
          )}

          {/* Core Content Area */}
          <main className="flex-1 overflow-y-auto bg-[#0A0E14]">
            {children}
          </main>
        </div>

        {/* Global Overlays */}
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
        <CommandPalette />
        <AICopilotWidget />
      </div>
    </AppContext.Provider>
  );
}
