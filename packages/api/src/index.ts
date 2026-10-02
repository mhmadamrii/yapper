import { initTRPC, TRPCError } from '@trpc/server';

import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { eq } from 'drizzle-orm';

import type { Context } from './context';

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      cause: 'No session',
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

// Owner-only tooling (moderation). The role is read from the DB on every
// call rather than the session, so it's authoritative and can't be stale
// behind better-auth's cookie cache.
export async function isOwner(userId: string) {
  const row = await createDb().query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true },
  });
  return row?.role === 'owner';
}

export const ownerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!(await isOwner(ctx.session.user.id))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner only' });
  }
  return next();
});
