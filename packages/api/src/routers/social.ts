import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { block, follow, mute, userStats } from '@yapper/db/schema/social';
import { z } from 'zod';

import { protectedProcedure, router } from '../index';

const userColumns = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  image: true,
} as const;

export const socialRouter = router({
  setBlock: protectedProcedure
    .input(z.object({ userId: z.string().min(1), blocked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const blockerId = ctx.session.user.id;

      if (blockerId === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "You can't block yourself",
        });
      }

      if (input.blocked) {
        const inserted = await db
          .insert(block)
          .values({ blockerId, blockedId: input.userId })
          .onConflictDoNothing()
          .returning({ blockerId: block.blockerId });

        if (inserted.length > 0) {
          // Blocking severs any existing follow relationship in either direction.
          const [deletedAB, deletedBA] = await db.batch([
            db
              .delete(follow)
              .where(
                and(
                  eq(follow.followerId, blockerId),
                  eq(follow.followeeId, input.userId),
                ),
              )
              .returning({ id: follow.followerId }),
            db
              .delete(follow)
              .where(
                and(
                  eq(follow.followerId, input.userId),
                  eq(follow.followeeId, blockerId),
                ),
              )
              .returning({ id: follow.followerId }),
          ]);

          const decrements: Promise<unknown>[] = [];
          if (deletedAB.length > 0) {
            decrements.push(
              db
                .update(userStats)
                .set({
                  followerCount: sql`GREATEST(${userStats.followerCount} - 1, 0)`,
                })
                .where(eq(userStats.userId, input.userId)),
              db
                .update(userStats)
                .set({
                  followingCount: sql`GREATEST(${userStats.followingCount} - 1, 0)`,
                })
                .where(eq(userStats.userId, blockerId)),
            );
          }
          if (deletedBA.length > 0) {
            decrements.push(
              db
                .update(userStats)
                .set({
                  followerCount: sql`GREATEST(${userStats.followerCount} - 1, 0)`,
                })
                .where(eq(userStats.userId, blockerId)),
              db
                .update(userStats)
                .set({
                  followingCount: sql`GREATEST(${userStats.followingCount} - 1, 0)`,
                })
                .where(eq(userStats.userId, input.userId)),
            );
          }
          if (decrements.length > 0) {
            await Promise.all(decrements);
          }
        }
      } else {
        await db
          .delete(block)
          .where(
            and(
              eq(block.blockerId, blockerId),
              eq(block.blockedId, input.userId),
            ),
          );
      }

      return { blocked: input.blocked };
    }),

  setMute: protectedProcedure
    .input(z.object({ userId: z.string().min(1), muted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const muterId = ctx.session.user.id;

      if (muterId === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "You can't mute yourself",
        });
      }

      if (input.muted) {
        await db
          .insert(mute)
          .values({ muterId, mutedId: input.userId })
          .onConflictDoNothing();
      } else {
        await db
          .delete(mute)
          .where(
            and(eq(mute.muterId, muterId), eq(mute.mutedId, input.userId)),
          );
      }

      return { muted: input.muted };
    }),

  blockedUsers: protectedProcedure.query(async ({ ctx }) => {
    const db = createDb();
    const rows = await db.query.block.findMany({
      where: eq(block.blockerId, ctx.session.user.id),
      orderBy: (row, { desc }) => [desc(row.createdAt)],
      with: { blocked: { columns: userColumns } },
    });
    return rows.map((row) => row.blocked);
  }),

  mutedUsers: protectedProcedure.query(async ({ ctx }) => {
    const db = createDb();
    const rows = await db.query.mute.findMany({
      where: eq(mute.muterId, ctx.session.user.id),
      orderBy: (row, { desc }) => [desc(row.createdAt)],
      with: { muted: { columns: userColumns } },
    });
    return rows.map((row) => row.muted);
  }),
});
