import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { botConfig } from '@yapper/db/schema/bot';
import { community, communityMember } from '@yapper/db/schema/community';
import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { isOwner, ownerProcedure, protectedProcedure, router } from '../index';
import { pageCommunityPosts } from './post';

const PAGE_SIZE = 30;

export const moderationRouter = router({
  // Never throws — the web route guard uses it to decide whether to render.
  isOwner: protectedProcedure.query(({ ctx }) => isOwner(ctx.session.user.id)),

  // Keyset pagination on (createdAt, id), newest first.
  users: ownerProcedure
    .input(
      z.object({
        query: z.string().trim().max(50).optional(),
        cursor: z
          .object({ createdAt: z.coerce.date(), id: z.string() })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = createDb();
      const term = input.query ? `%${input.query}%` : undefined;

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          image: user.image,
          role: user.role,
          isBot: user.isBot,
          verified: user.emailVerified,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(
          and(
            term
              ? or(
                  ilike(user.username, term),
                  ilike(user.name, term),
                  ilike(user.email, term),
                )
              : undefined,
            input.cursor
              ? or(
                  lt(user.createdAt, input.cursor.createdAt),
                  and(
                    eq(user.createdAt, input.cursor.createdAt),
                    lt(user.id, input.cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(user.createdAt), desc(user.id))
        .limit(PAGE_SIZE + 1);

      const items = rows.slice(0, PAGE_SIZE);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > PAGE_SIZE && last
            ? { createdAt: last.createdAt, id: last.id }
            : undefined,
      };
    }),

  // Every community, private included — the picker for `communityPosts`.
  // Small table, so one unpaginated read.
  communities: ownerProcedure.query(() =>
    createDb()
      .select({
        id: community.id,
        name: community.name,
        visibility: community.visibility,
        memberCount: community.memberCount,
      })
      .from(community)
      .orderBy(asc(community.name)),
  ),

  // Every bot across all owners, with the community it is assigned to.
  bots: ownerProcedure.query(() =>
    createDb()
      .select({
        userId: botConfig.userId,
        name: user.name,
        username: user.username,
        image: user.image,
        active: botConfig.active,
        communityId: botConfig.communityId,
        communityName: community.name,
      })
      .from(botConfig)
      .innerJoin(user, eq(user.id, botConfig.userId))
      .leftJoin(community, eq(community.id, botConfig.communityId))
      .orderBy(asc(user.name)),
  ),

  // Points a bot at a community (or `null` to detach). The bot is also made
  // a member so it counts like any other poster; the old membership is
  // dropped, with `memberCount` kept in step (atomic +/-1, never COUNT(*)).
  assignBotCommunity: ownerProcedure
    .input(
      z.object({
        botId: z.string().min(1),
        communityId: z.string().min(1).nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = createDb();

      await db.transaction(async (tx) => {
        const bot = await tx.query.botConfig.findFirst({
          where: eq(botConfig.userId, input.botId),
          columns: { communityId: true },
        });
        if (!bot) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Bot not found' });
        }
        if (bot.communityId === input.communityId) return;

        if (input.communityId) {
          const target = await tx.query.community.findFirst({
            where: eq(community.id, input.communityId),
            columns: { id: true },
          });
          if (!target) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Community not found',
            });
          }
        }

        if (bot.communityId) {
          const removed = await tx
            .delete(communityMember)
            .where(
              and(
                eq(communityMember.communityId, bot.communityId),
                eq(communityMember.userId, input.botId),
              ),
            )
            .returning({ userId: communityMember.userId });
          if (removed.length > 0) {
            await tx
              .update(community)
              .set({ memberCount: sql`${community.memberCount} - 1` })
              .where(eq(community.id, bot.communityId));
          }
        }

        if (input.communityId) {
          const inserted = await tx
            .insert(communityMember)
            .values({ communityId: input.communityId, userId: input.botId })
            .onConflictDoNothing()
            .returning({ userId: communityMember.userId });
          if (inserted.length > 0) {
            await tx
              .update(community)
              .set({ memberCount: sql`${community.memberCount} + 1` })
              .where(eq(community.id, input.communityId));
          }
        }

        await tx
          .update(botConfig)
          .set({ communityId: input.communityId })
          .where(eq(botConfig.userId, input.botId));
      });

      return { ok: true };
    }),

  // A community's posts regardless of visibility or membership, replies
  // included, and no block/mute filtering — moderation sees everything.
  communityPosts: ownerProcedure
    .input(
      z.object({
        communityId: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(({ ctx, input }) =>
      pageCommunityPosts(createDb(), {
        communityId: input.communityId,
        viewerId: ctx.session.user.id,
        limit: input.limit,
        cursor: input.cursor,
        includeReplies: true,
      }),
    ),

  setVerified: ownerProcedure
    .input(z.object({ userId: z.string().min(1), verified: z.boolean() }))
    .mutation(async ({ input }) => {
      await createDb()
        .update(user)
        .set({ emailVerified: input.verified })
        .where(eq(user.id, input.userId));
      return { userId: input.userId, verified: input.verified };
    }),
});
