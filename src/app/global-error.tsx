'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: 'var(--background)', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '24px', padding: '32px' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400 }}>The page couldn&apos;t load</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center', maxWidth: '400px' }}>
            {error.message || 'An unexpected error occurred. Try again.'}
          </p>
          {error.digest && <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)' }}>ID: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ padding: '8px 20px', background: 'var(--accent)', color: 'var(--surface-0)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
