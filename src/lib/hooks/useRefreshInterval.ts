import { useEffect } from 'react';

/**
 * Shared hook for auto-refresh with visibility-change awareness.
 *
 * - Calls `fetchData` immediately on mount
 * - Sets up a repeating interval
 * - Pauses on tab hide, resumes (with immediate fetch) on tab show
 * - Clears old interval before starting new one (no leak)
 * - Guards against post-unmount fetches
 */
export function useRefreshInterval(
  fetchData: () => void | Promise<void>,
  intervalMs: number = 5 * 60 * 1000,
) {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let active = true;

    const guarded = () => { if (active) fetchData(); };
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const start = () => { stop(); guarded(); interval = setInterval(guarded, intervalMs); };
    const onVis = () => { if (document.hidden) stop(); else start(); };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { active = false; stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchData, intervalMs]);
}
