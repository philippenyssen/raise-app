'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';
import { ErrorBoundary } from './ui/error-boundary';

const BARE_ROUTES = ['/login'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'));

  if (isBare) {
    return <ErrorBoundary>{children}</ErrorBoundary>;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: '1200px',
              padding: 'var(--space-8) var(--space-8)',
              paddingLeft: 'max(var(--space-8), 3.5rem)',
            }}>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
