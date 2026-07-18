/**
 * Compacts a count for engagement UI: numbers below 1000 render as-is,
 * larger ones as a one-decimal "K" value with a trailing `.0` stripped.
 *
 * ```ts
 * formatCount(941); // "941"
 * formatCount(3941); // "3.9K"
 * formatCount(15000); // "15K"
 * ```
 */
export function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : `${n}`;
}

/**
 * Formats a timestamp as a compact relative age for feed rows: `42s`, `5m`,
 * `2h`, `12d` — and past 30 days falls back to the locale date string.
 * Accepts a `Date` or anything `new Date()` parses (e.g. the ISO strings
 * tRPC serializes dates to). Future timestamps clamp to `0s`.
 */
export function timeAgo(date: string | number | Date) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(date).toLocaleDateString();
}
