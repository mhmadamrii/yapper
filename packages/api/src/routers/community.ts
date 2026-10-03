import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { community, communityMember } from '@yapper/db/schema/community';
import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { getViewerExclusions } from '../lib/social-filters';

import {
  protectedProcedure,
  publicProcedure,
  router,
  verifiedProcedure,
} from '../index';

const PAGE_SIZE = 20;
const MAX_COMMUNITIES_PER_OWNER = 5;

const summaryColumns = {
  id: community.id,
  name: community.name,
  description: community.description,
  coverKey: community.coverKey,
  visibility: community.visibility,
  memberCount: community.memberCount,
};

export const communityRouter = router({
  // Verified users only. Caps communities per owner since creation is cheap
  // to spam once past the verified gate.
  create: verifiedProcedure
    .input(
      z.object({
        name: z.string().trim().min(3).max(50),
        description: z.string().trim().min(1).max(500),
        visibility: z.enum(['public', 'private']),
        coverKey: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session.user.id;

      const [row] = await db
        .select({ owned: sql<number>`count(*)::int` })
        .from(community)
        .where(eq(community.ownerId, me));
      if ((row?.owned ?? 0) >= MAX_COMMUNITIES_PER_OWNER) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You can own up to ${MAX_COMMUNITIES_PER_OWNER} communities`,
        });
      }

      const id = crypto.randomUUID();
      try {
        await db.transaction(async (tx) => {
          await tx.insert(community).values({
            id,
            name: input.name,
            description: input.description,
            visibility: input.visibility,
            coverKey: input.coverKey,
            ownerId: me,
            memberCount: 1,
          });
          await tx
            .insert(communityMember)
            .values({ communityId: id, userId: me, role: 'owner' });
        });
      } catch (error) {
        // Unique violation on `name`.
        if ((error as { code?: string }).code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A community with that name already exists',
          });
        }
        throw error;
      }
      return { id };
    }),

  // Owner or moderator only. Visibility is fixed at creation.
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(3).max(50),
        description: z.string().trim().min(1).max(500),
        coverKey: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();

      const membership = await db.query.communityMember.findFirst({
        where: and(
          eq(communityMember.communityId, input.id),
          eq(communityMember.userId, ctx.session.user.id),
        ),
        columns: { role: true },
      });
      if (membership?.role !== 'owner' && membership?.role !== 'moderator') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only owners and moderators can edit this community',
        });
      }

      try {
        await db
          .update(community)
          .set({
            name: input.name,
            description: input.description,
            ...(input.coverKey ? { coverKey: input.coverKey } : {}),
          })
          .where(eq(community.id, input.id));
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A community with that name already exists',
          });
        }
        throw error;
      }
      return { id: input.id };
    }),

  // Discover: biggest first, keyset on (memberCount, id). Public and private
  // communities are both listed (private shows as joinable-by-request).
  list: publicProcedure
    .input(
      z.object({
        query: z.string().trim().max(50).optional(),
        cursor: z
          .object({ memberCount: z.number().int(), id: z.string() })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session?.user.id;
      const term = input.query ? `%${input.query}%` : undefined;

      const rows = await db
        .select({
          ...summaryColumns,
          joined: me
            ? sql<boolean>`exists (select 1 from ${communityMember} m where m.community_id = ${community.id} and m.user_id = ${me})`
            : sql<boolean>`false`,
        })
        .from(community)
        .where(
          and(
            term ? ilike(community.name, term) : undefined,
            input.cursor
              ? or(
                  lt(community.memberCount, input.cursor.memberCount),
                  and(
                    eq(community.memberCount, input.cursor.memberCount),
                    lt(community.id, input.cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(community.memberCount), desc(community.id))
        .limit(PAGE_SIZE + 1);

      const items = rows.slice(0, PAGE_SIZE);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > PAGE_SIZE && last
            ? { memberCount: last.memberCount, id: last.id }
            : undefined,
      };
    }),

  mine: protectedProcedure.query(({ ctx }) =>
    createDb()
      .select({ ...summaryColumns, role: communityMember.role })
      .from(communityMember)
      .innerJoin(community, eq(community.id, communityMember.communityId))
      .where(eq(communityMember.userId, ctx.session.user.id))
      .orderBy(desc(communityMember.joinedAt)),
  ),

  byId: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session?.user.id;

      const [found] = await db
        .select({
          ...summaryColumns,
          createdAt: community.createdAt,
          owner: {
            id: user.id,
            name: user.name,
            username: user.username,
            image: user.image,
            verified: user.emailVerified,
          },
        })
        .from(community)
        .innerJoin(user, eq(user.id, community.ownerId))
        .where(eq(community.id, input.id));
      if (!found) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }

      const membership = me
        ? await db.query.communityMember.findFirst({
            where: and(
              eq(communityMember.communityId, input.id),
              eq(communityMember.userId, me),
            ),
            columns: { role: true },
          })
        : undefined;

      return { ...found, role: membership?.role ?? null };
    }),

  // Members, newest first (keyset on (joinedAt, userId)). Private
  // communities only list members to members — others get `locked: true`.
  members: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(30),
        cursor: z
          .object({ joinedAt: z.coerce.date(), userId: z.string() })
          .nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session?.user.id;

      const found = await db.query.community.findFirst({
        where: eq(community.id, input.id),
        columns: { visibility: true },
      });
      if (!found) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }
      if (found.visibility === 'private') {
        const mine = me
          ? await db.query.communityMember.findFirst({
              where: and(
                eq(communityMember.communityId, input.id),
                eq(communityMember.userId, me),
              ),
              columns: { userId: true },
            })
          : undefined;
        if (!mine) {
          return { locked: true as const, items: [], nextCursor: null };
        }
      }

      const { blocked } = await getViewerExclusions(db, me);
      const { cursor } = input;

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          username: user.username,
          image: user.image,
          verified: user.emailVerified,
          role: communityMember.role,
          joinedAt: communityMember.joinedAt,
        })
        .from(communityMember)
        .innerJoin(user, eq(user.id, communityMember.userId))
        .where(
          and(
            eq(communityMember.communityId, input.id),
            cursor
              ? or(
                  lt(communityMember.joinedAt, cursor.joinedAt),
                  and(
                    eq(communityMember.joinedAt, cursor.joinedAt),
                    lt(communityMember.userId, cursor.userId),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(communityMember.joinedAt), desc(communityMember.userId))
        .limit(input.limit + 1);

      const page = rows.slice(0, input.limit);
      const last = page.at(-1);
      return {
        locked: false as const,
        items: page.filter((row) => !blocked.has(row.id)),
        nextCursor:
          rows.length > input.limit && last
            ? { joinedAt: last.joinedAt, userId: last.id }
            : null,
      };
    }),

  // Public communities only — private ones go through request-to-join.
  join: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session.user.id;

      const found = await db.query.community.findFirst({
        where: eq(community.id, input.id),
        columns: { visibility: true },
      });
      if (!found) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Community not found',
        });
      }
      if (found.visibility !== 'public') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This community is private — request to join instead',
        });
      }

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(communityMember)
          .values({ communityId: input.id, userId: me })
          .onConflictDoNothing()
          .returning({ userId: communityMember.userId });
        // Only bump the counter when a row was actually inserted.
        if (inserted.length > 0) {
          await tx
            .update(community)
            .set({ memberCount: sql`${community.memberCount} + 1` })
            .where(eq(community.id, input.id));
        }
      });
      return { id: input.id };
    }),

  // Owners can't leave their own community (no transfer flow yet).
  leave: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session.user.id;

      await db.transaction(async (tx) => {
        const deleted = await tx
          .delete(communityMember)
          .where(
            and(
              eq(communityMember.communityId, input.id),
              eq(communityMember.userId, me),
              sql`${communityMember.role} <> 'owner'`,
            ),
          )
          .returning({ userId: communityMember.userId });
        if (deleted.length > 0) {
          await tx
            .update(community)
            .set({ memberCount: sql`${community.memberCount} - 1` })
            .where(eq(community.id, input.id));
        }
      });
      return { id: input.id };
    }),
});
