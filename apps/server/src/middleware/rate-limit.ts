import { env } from '@yapper/env/server';
import type { MiddlewareHandler } from 'hono';

export const authRateLimit: MiddlewareHandler = async (c, next) => {
  if (c.req.method !== 'POST') {
    return next();
  }

  const key = c.req.header('cf-connecting-ip') ?? 'local-dev';
  const { success } = await env.RATE_LIMITER.limit({ key });

  if (!success) {
    return c.json({ error: 'Too many requests, try again later.' }, 429);
  }

  return next();
};
