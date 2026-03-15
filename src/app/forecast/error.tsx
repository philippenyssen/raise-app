'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function ForecastError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center" style={{ maxWidth: '1400px', margin: '0 auto', minHeight: '60vh' }}>
      <span style={{ color: 'var(--danger)', marginBottom: '16px' }}>
        <AlertTriangle className="w-10 h-10" />
      </span>
      <h2 className="text-lg font-normal mb-2" style={{ color: 'var(--text-primary)' }}>
        Forecast failed to load
      </h2>
      <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn btn-primary btn-md">Try again</button>
        <Link href="/" className="btn btn-secondary btn-md">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
