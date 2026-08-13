import { trpcServer } from '@hono/trpc-server';
import { createContext } from '@yapper/api/context';
import { computeTrending } from '@yapper/api/lib/trending';
import { appRouter } from '@yapper/api/routers/index';
import { createAuth } from '@yapper/auth';
import { createDb } from '@yapper/db';
import { conversationParticipant } from '@yapper/db/schema/message';
import { env } from '@yapper/env/server';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { authRateLimit } from './middleware/rate-limit';

export { ConversationRoom } from './durable-objects/conversation-room';

const app = new Hono();

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

  // Cast through a minimal shape: Alchemy's binding type for `env` and the
  // `ConversationRoom` class both recursively reference the Worker's own Env
  // type, which sends full generic resolution into a TS2589 spiral — we only
  // ever forward a plain fetch, so a narrow interface sidesteps it.
  const namespace = env.CONVERSATION_DO as unknown as {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  const id = namespace.idFromName(conversationId);
  return namespace.get(id).fetch(c.req.raw);
});

// Hono's `app` is exported as the `fetch` handler rather than as the default
// export directly, so the Worker can also carry a `scheduled` handler. The
// cron trigger itself lives in `packages/infra/alchemy.run.ts` (`crons`) —
// this side only reacts to it.
export default {
  fetch: app.fetch,
  scheduled: (
    _controller: ScheduledController,
    _env: unknown,
    ctx: ExecutionContext,
  ) => {
    // waitUntil keeps the Worker alive past the handler's synchronous return
    // — without it the compute would be cancelled mid-query.
    ctx.waitUntil(
      computeTrending().catch((error) => {
        // A failed tick is survivable: the previous snapshot stays served
        // until the next run in 5 minutes.
        console.error('[cron] trending compute failed', error);
      }),
    );
  },
};
