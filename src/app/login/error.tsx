'use client';
import PageError from '@/components/page-error';
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError label="Login" error={error} reset={reset} />;
}
