import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { community } from '@yapper/db/schema/community';
import { and, asc, desc, eq, ilike, lt, or } from 'drizzle-orm';
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
