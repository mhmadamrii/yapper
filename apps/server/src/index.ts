import { trpcServer } from '@hono/trpc-server';
import { createContext } from '@yapper/api/context';
import { subscribeToConversation } from '@yapper/api/lib/conversation-hub';
import { appRouter } from '@yapper/api/routers/index';
import { createAuth } from '@yapper/auth';
import { createDb } from '@yapper/db';
import { conversationParticipant } from '@yapper/db/schema/message';
import { ensureInterestsSeeded } from '@yapper/db/seed/interests';
import { env } from '@yapper/env/server';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { authRateLimit } from './middleware/rate-limit';

const app = new Hono();

// Diagnostic-only request timing, added for the 2026-08-19 latency
// investigation (root-caused to Neon cold starts — since moot, the server
// now runs on a self-hosted VPS with a long-lived connection). Left in as
// general request-timing instrumentation; flip to false when no longer needed.
const REQUEST_TIMING_ENABLED = true;

if (REQUEST_TIMING_ENABLED) {
  app.use('*', async (c, next) => {
    const start = Date.now();
    console.log(`[REQ] ${c.req.method} ${c.req.path} received start=${start}`);
    await next();
    const end = Date.now();
    console.log(
      `[REQ] ${c.req.method} ${c.req.path} → ${c.res.status} ${end - start}ms start=${start} end=${end}`,
    );
  });
}

app.use(logger());
app.use(
  '/*',
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.use('/api/auth/*', authRateLimit);
app.on(['POST', 'GET'], '/api/auth/*', (c) => createAuth().handler(c.req.raw));

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get('/', (c) => {
  return c.text('OK');
});

// SSE fan-out for a conversation's already-open readers. Auth is via the
// better-auth session cookie — EventSource can't set custom headers, but it
// does send cookies when constructed with `withCredentials: true`, and CORS
// above reflects a concrete origin (not `*`) with `credentials: true`, so the
// browser allows it cross-origin.
app.get('/conversations/:id/stream', async (c) => {
  const session = await createAuth().api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) return c.text('Unauthorized', 401);

  const conversationId = c.req.param('id');
  const db = createDb();
  const participant = await db.query.conversationParticipant.findFirst({
    where: and(
      eq(conversationParticipant.conversationId, conversationId),
      eq(conversationParticipant.userId, session.user.id),
    ),
  });
  if (!participant) return c.text('Forbidden', 403);

  return subscribeToConversation(conversationId, c.req.raw.signal);
});

// Idempotent upsert of the fixed interest catalog — cheap (~24 rows), so
// it's safe to run on every boot instead of a separate deploy/migration step.
await ensureInterestsSeeded(createDb());

Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});
