'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };

const typeStyles: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: {
    bg: 'var(--success-muted)',
    border: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
    icon: '#22c55e',
  },
  error: {
    bg: 'var(--danger-muted)',
    border: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    icon: '#ef4444',
  },
  warning: {
    bg: 'var(--warning-muted)',
    border: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24',
    icon: '#f59e0b',
  },
  info: {
    bg: 'var(--accent-muted)',
    border: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
    icon: '#3b82f6',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = crypto.randomUUID();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed z-[100]"
        style={{
          bottom: 'var(--space-5)',
          right: 'var(--space-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          maxWidth: '380px',
        }}
      >
        {toasts.map(t => {
          const Icon = icons[t.type];
          const styles = typeStyles[t.type];
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 animate-slide-in"
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${styles.border}`,
                background: styles.bg,
                backdropFilter: 'blur(12px)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: 'var(--font-size-sm)',
                color: styles.color,
              }}
            >
              <Icon className="shrink-0" style={{ width: '16px', height: '16px', color: styles.icon }} />
              <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded transition-opacity"
                style={{ opacity: 0.5, color: styles.color }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
