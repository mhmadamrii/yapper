import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { botConfig } from '@yapper/db/schema/bot';
import { env } from '@yapper/env/server';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { protectedProcedure, router } from '../index';
import { postForBot } from '../lib/bot-scheduler';

const MAX_BOTS_PER_OWNER = 3;
const MIN_POST_INTERVAL_MINUTES = 60;
// Matches the suffix every human account gets (see
// `apps/web/src/components/sign-up-form.tsx`) — bots' handles look like
// every other account's, not a separate namespace.
const USERNAME_SUFFIX = '.yapper';

async function requireOwnedBot(
  db: ReturnType<typeof createDb>,
  userId: string,
  ownerId: string,
) {
  const owned = await db.query.botConfig.findFirst({
    where: and(eq(botConfig.userId, userId), eq(botConfig.ownerId, ownerId)),
  });
  if (!owned) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Bot not found' });
  }
  return owned;
}

export const botRouter = router({
  // The caller's own bots only — there's no admin view across all owners.
  list: protectedProcedure.query(({ ctx }) =>
    createDb()
      .select({
        userId: botConfig.userId,
        name: user.name,
        username: user.username,
        image: user.image,
        systemPrompt: botConfig.systemPrompt,
        postIntervalMinutes: botConfig.postIntervalMinutes,
        active: botConfig.active,
        lastPostedAt: botConfig.lastPostedAt,
      })
      .from(botConfig)
      .innerJoin(user, eq(user.id, botConfig.userId))
      .where(eq(botConfig.ownerId, ctx.session.user.id)),
  ),

  // Gated by a static env password — a temporary stopgap until real
  // role-based access exists, not a real security boundary. Also caps bots
  // per owner and the minimum posting interval server-side, since the
  // password alone doesn't limit how much Gemini spend one account can
  // create once past the gate.
  create: protectedProcedure
    .input(
      z.object({
        password: z.string().min(1),
        name: z.string().trim().min(1).max(100),
        username: z
          .string()
          .trim()
          .min(3)
          .max(20)
          .regex(
            /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
            'Lowercase letters, numbers, and hyphens only',
          ),
        systemPrompt: z.string().trim().min(1).max(2000),
        postIntervalMinutes: z.number().int().min(MIN_POST_INTERVAL_MINUTES),
        avatarObjectKey: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.password !== env.BOT_CREATION_PASSWORD) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Wrong password' });
      }

      const db = createDb();
      const ownerId = ctx.session.user.id;

      const [ownedCount] = await db
        .select({ value: count() })
        .from(botConfig)
        .where(eq(botConfig.ownerId, ownerId));
      if ((ownedCount?.value ?? 0) >= MAX_BOTS_PER_OWNER) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `You can only have ${MAX_BOTS_PER_OWNER} bots`,
        });
      }

      const username = input.username + USERNAME_SUFFIX;
      const existing = await db.query.user.findFirst({
        where: eq(user.username, username),
        columns: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Username is already taken',
        });
      }

      const botId = crypto.randomUUID();

      await db.transaction(async (tx) => {
        // A bot never logs in, so it never needs an `account` row — just a
        // `user` row to be a valid post author / render like any account.
        await tx.insert(user).values({
          id: botId,
          name: input.name,
          username,
          // Synthetic and unique — bots never receive email, this only
          // satisfies the column's NOT NULL + unique constraint.
          email: `bot+${botId}@bots.internal`,
          emailVerified: true,
          isBot: true,
          image: input.avatarObjectKey,
        });
        await tx.insert(botConfig).values({
          userId: botId,
          ownerId,
          systemPrompt: input.systemPrompt,
          postIntervalMinutes: input.postIntervalMinutes,
        });
      });

      return { id: botId };
    }),

  // Editing a bot you already own isn't the dangerous action — creating a
  // new one is — so this doesn't re-check the password.
  update: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        name: z.string().trim().min(1).max(100).optional(),
        avatarObjectKey: z.string().min(1).optional(),
        systemPrompt: z.string().trim().min(1).max(2000).optional(),
        postIntervalMinutes: z
          .number()
          .int()
          .min(MIN_POST_INTERVAL_MINUTES)
          .optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      await requireOwnedBot(db, input.userId, ctx.session.user.id);

      if (input.name !== undefined || input.avatarObjectKey !== undefined) {
        await db
          .update(user)
          .set({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.avatarObjectKey !== undefined
              ? { image: input.avatarObjectKey }
              : {}),
          })
          .where(eq(user.id, input.userId));
      }

      if (
        input.systemPrompt !== undefined ||
        input.postIntervalMinutes !== undefined ||
        input.active !== undefined
      ) {
        await db
          .update(botConfig)
          .set({
            ...(input.systemPrompt !== undefined
              ? { systemPrompt: input.systemPrompt }
              : {}),
            ...(input.postIntervalMinutes !== undefined
              ? { postIntervalMinutes: input.postIntervalMinutes }
              : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
          })
          .where(eq(botConfig.userId, input.userId));
      }

      return { ok: true };
    }),

  // Deletes the bot's `user` row — cascades through `botConfig` and every
  // post it authored (`post.authorId` is already `onDelete: 'cascade'`), so
  // one delete cleans up everything.
  delete: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      await requireOwnedBot(db, input.userId, ctx.session.user.id);
      await db.delete(user).where(eq(user.id, input.userId));
      return { id: input.userId };
    }),

  // Manual trigger — lets a human verify a fresh bot's prompt actually
  // produces something reasonable without waiting for the interval.
  generateNow: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const bot = await requireOwnedBot(db, input.userId, ctx.session.user.id);
      return postForBot(db, bot);
    }),
});
