'use client';

import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function PipelineError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
      <div className="flex flex-col items-center gap-3">
        <span style={{ color: 'var(--danger)' }}><AlertTriangle size={40} /></span>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-xl)' }} className="font-normal">
          Pipeline failed to load
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }} className="text-center max-w-md">
          {error.message || 'Something went wrong loading the pipeline view.'}
        </p>
        {error.digest && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="btn btn-primary btn-md flex items-center gap-2">
          <RefreshCw size={16} /> Retry
        </button>
        <Link href="/" className="btn btn-secondary btn-md">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
