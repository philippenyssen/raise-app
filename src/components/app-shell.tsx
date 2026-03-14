'use client';

import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { ErrorBoundary } from './ui/error-boundary';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: '1400px',
              padding: 'var(--space-6) var(--space-6)',
              paddingLeft: 'max(var(--space-6), 3.5rem)',
            }}
          >
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
