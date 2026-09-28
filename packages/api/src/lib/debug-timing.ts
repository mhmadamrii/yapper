/**
 * Diagnostic-only timing logs, added for the 2026-08-19 API latency
 * investigation (root-caused to Neon cold starts — since moot, the server
 * now runs on a self-hosted VPS with a long-lived connection). Left in as
 * general request-timing instrumentation. Flip TIMING_LOGS_ENABLED to false
 * (or delete the call sites) once no longer needed — not meant to stay on
 * in steady state.
 */
export const TIMING_LOGS_ENABLED = true;

// `[DB] notification.unreadCount 2890ms start=1755590051234 end=1755590054124`
// — call with the timestamp from right before the DB call(s) start. Absolute
// start/end (not just duration) is what lets you check, across procedures
// logged within the same tRPC batch, whether their windows overlap
// (concurrent) or back-to-back (serialized).
export function logDbTiming(label: string, startedAt: number) {
  if (!TIMING_LOGS_ENABLED) return;
  const endedAt = Date.now();
  console.log(
    `[DB] ${label} ${endedAt - startedAt}ms start=${startedAt} end=${endedAt}`,
  );
}
