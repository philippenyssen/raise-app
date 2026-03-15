/**
 * Shared formatting utilities — standardised on en-GB locale.
 */

/** "15 Mar 2026" */
export const fmtDate = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  if (d === 'N/A') return 'N/A';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "15 Mar" */
export const fmtDateShort = (d: Date | string | null | undefined): string => {
  if (!d) return '—';
  if (d === 'N/A') return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

/** "15 Mar 2026, 14:30" */
export const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "Friday, 15 March 2026" */
export const fmtDateFull = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
