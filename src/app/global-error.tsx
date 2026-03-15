'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#e5e5e5' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '24px', padding: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 400 }}>Something went wrong</h2>
          <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', maxWidth: '400px' }}>
            {error.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {error.digest && <p style={{ color: '#666', fontSize: '12px' }}>ID: {error.digest}</p>}
          <button
            onClick={reset}
            style={{ padding: '8px 20px', background: '#c9a55a', color: '#0a0a0a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
