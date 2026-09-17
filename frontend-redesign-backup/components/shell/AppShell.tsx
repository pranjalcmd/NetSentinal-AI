'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ToastContainer } from './ToastContainer';
import { CommandPalette } from './CommandPalette';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  durationMs?: number;
}

export interface AppContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
}

export const AppContext = createContext<AppContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
  commandPaletteOpen: false,
  setCommandPaletteOpen: () => {},
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

  const contextValue: AppContextValue = {
    toasts,
    addToast,
    removeToast,
    commandPaletteOpen,
    setCommandPaletteOpen,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div className="flex h-screen bg-[#0A0E14] text-[#E4E8EE] overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-[#0A0E14]">
            {children}
          </main>
        </div>

        <ToastContainer toasts={toasts} onDismiss={removeToast} />
        <CommandPalette />
      </div>
    </AppContext.Provider>
  );
}
