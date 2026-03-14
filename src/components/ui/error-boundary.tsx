'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="text-center"
          style={{
            border: '1px solid rgba(239, 68, 68, 0.2)',
            background: 'var(--danger-muted)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-8)',
          }}
        >
          <div className="flex flex-col items-center" style={{ gap: 'var(--space-3)' }}>
            <AlertTriangle style={{ width: '32px', height: '32px', color: 'var(--danger)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>
              {this.props.fallbackMessage || 'Something went wrong loading this page.'}
            </p>
            {this.state.error && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 'var(--space-2)' }}
            >
              <RotateCcw style={{ width: '14px', height: '14px' }} /> Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
