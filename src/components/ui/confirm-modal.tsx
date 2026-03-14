'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="max-w-sm w-full mx-4 animate-slide-down"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--space-5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start" style={{ gap: 'var(--space-3)' }}>
          {variant === 'danger' && (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--danger-muted)',
              }}
            >
              <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--danger)' }} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--font-size-base)' }}>{title}</h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        <div className="flex justify-end" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
          <button
            onClick={onCancel}
            className="btn btn-ghost btn-md"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`btn btn-md ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InputModalProps {
  open: boolean;
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputModal({
  open,
  title,
  placeholder = '',
  confirmLabel = 'Create',
  onConfirm,
  onCancel,
}: InputModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef('');

  useEffect(() => {
    if (open) {
      valueRef.current = '';
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && valueRef.current.trim()) onConfirm(valueRef.current.trim());
  }, [onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="max-w-sm w-full mx-4 animate-slide-down"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          padding: 'var(--space-5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>{title}</h3>
        <input
          ref={inputRef}
          defaultValue=""
          onChange={e => { valueRef.current = e.target.value; }}
          placeholder={placeholder}
          className="input"
        />
        <div className="flex justify-end" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <button onClick={onCancel} className="btn btn-ghost btn-md">
            Cancel
          </button>
          <button
            onClick={() => { if (valueRef.current.trim()) onConfirm(valueRef.current.trim()); }}
            className="btn btn-primary btn-md"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
