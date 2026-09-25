import type { MiddlewareHandler } from 'hono';

const LIMIT = 10;
const WINDOW_MS = 60_000;

// In-memory fixed-window counter, per process — replaces the Cloudflare
// Rate Limiting binding. Fine for a single VPS container; would need a
// Redis-backed limiter if the server ever runs more than one replica.
const hits = new Map<string, { count: number; resetAt: number }>();

export const authRateLimit: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'POST') {
    return next();
  }

  const key =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'local-dev';

  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
    if (entry.count > LIMIT) {
      return c.json({ error: 'Too many requests, try again later.' }, 429);
    }
  }

  return next();
};
