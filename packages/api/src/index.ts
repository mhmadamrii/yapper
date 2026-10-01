import { initTRPC, TRPCError } from '@trpc/server';

import { env } from '@yapper/env/server';

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

// Owner-only tooling (moderation). Gated on a single email from env — a
// stopgap until real roles exist. The check runs here, not just in the web
// route guard, so hitting the endpoint directly gets the same answer.
export function isOwnerEmail(email: string) {
  return email.toLowerCase() === env.OWNER_EMAIL.toLowerCase();
}

export const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isOwnerEmail(ctx.session.user.email)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner only' });
  }
  return next();
});
