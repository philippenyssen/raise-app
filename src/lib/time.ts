// Time constants (milliseconds) and formatting utilities

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** Days elapsed since a given date string or Date */
export function daysAgo(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_DAY);
}

/** Hours elapsed since a given date string or Date */
export function hoursAgo(date: string | Date): number {
  return Math.round((Date.now() - new Date(date).getTime()) / MS_PER_HOUR);
}

/** Human-readable relative time: "just now", "3m ago", "2h ago" */
export function relativeTime(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / MS_PER_MINUTE);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
