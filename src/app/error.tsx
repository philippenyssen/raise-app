'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[GLOBAL_ERROR]', error.message, error.digest);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
      <div className="flex flex-col items-center gap-3">
        <span style={{ color: 'var(--warning)' }}><AlertTriangle size={40} /></span>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-xl)' }} className="font-normal">
          Something went wrong
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }} className="text-center max-w-md">
          This page encountered an error. Your data is safe.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', wordBreak: 'break-word', maxWidth: '400px', textAlign: 'center' }}>
          {error.message || 'Unknown error'}
        </p>
        {error.digest && (
          <p style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Digest: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="btn btn-primary btn-sm flex items-center gap-2">
          <RefreshCw size={14} /> Try Again
        </button>
        <Link href="/today" className="btn btn-secondary btn-sm flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <Home size={14} /> Go Home
        </Link>
      </div>
    </div>
  );
}
