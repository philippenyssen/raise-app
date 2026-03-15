'use client';
import PageError from '@/components/page-error';
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError label="Momentum" error={error} reset={reset} />;
}
