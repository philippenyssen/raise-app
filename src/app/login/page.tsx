'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push(redirect);
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter password"
          autoFocus
          className="input"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-sm)',
          }}
        />
      </div>

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={!password || loading}
        className="btn btn-primary btn-lg"
        style={{
          width: '100%',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-3)',
          opacity: !password || loading ? 0.4 : 1,
        }}
      >
        {loading ? <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" /> : null}
        {loading ? 'Authenticating...' : 'Sign In'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center" style={{ marginBottom: 'var(--space-8)' }}>
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: '48px',
              height: '48px',
              background: 'var(--accent-muted)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--accent)', letterSpacing: '0.12em', fontFamily: 'var(--font-cormorant), Georgia, serif' }}>R</span>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.18em', fontFamily: 'var(--font-cormorant), Georgia, serif', textTransform: 'none' as const }}>
            RAISE
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            Series C Execution Platform
          </p>
        </div>

        <Suspense fallback={<div style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
