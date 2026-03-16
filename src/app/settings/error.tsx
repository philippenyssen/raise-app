'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function SettingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
      <span style={{ color: 'var(--danger)', marginBottom: 'var(--space-4)' }}>
        <AlertTriangle className="w-10 h-10" />
      </span>
      <h2 className="text-lg font-normal mb-2" style={{ color: 'var(--text-primary)' }}>
        Settings failed to load
      </h2>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn btn-primary btn-md">Retry</button>
        <Link href="/" className="btn btn-secondary btn-md">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
