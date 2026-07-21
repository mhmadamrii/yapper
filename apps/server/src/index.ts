import { trpcServer } from '@hono/trpc-server';
import { createContext } from '@yapper/api/context';
import { appRouter } from '@yapper/api/routers/index';
import { createAuth } from '@yapper/auth';
import { env } from '@yapper/env/server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { authRateLimit } from './middleware/rate-limit';

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

export default app;
