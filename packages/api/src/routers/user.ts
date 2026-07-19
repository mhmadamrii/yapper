import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { userProfile } from '@yapper/db/schema/profile';
import { follow, userStats } from '@yapper/db/schema/social';
import { z } from 'zod';

import { protectedProcedure, publicProcedure, router } from '../index';

export const userRouter = router({
  byId: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const viewerId = ctx.session?.user.id;

      const [found, stats, profile, followRows] = await Promise.all([
        db.query.user.findFirst({
          where: eq(user.id, input.id),
          columns: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            emailVerified: true,
            image: true,
            createdAt: true,
          },
        }),
        db.query.userStats.findFirst({
          where: eq(userStats.userId, input.id),
        }),
        db.query.userProfile.findFirst({
          where: eq(userProfile.userId, input.id),
        }),
        viewerId && viewerId !== input.id
          ? db
              .select({ followerId: follow.followerId })
              .from(follow)
              .where(
                and(
                  eq(follow.followerId, viewerId),
                  eq(follow.followeeId, input.id),
                ),
              )
              .limit(1)
          : Promise.resolve([]),
      ]);

      if (!found) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      return {
        ...found,
        // Stats row is created lazily on first write — absence means zeros.
        followerCount: stats?.followerCount ?? 0,
        followingCount: stats?.followingCount ?? 0,
        postCount: stats?.postCount ?? 0,
        followedByMe: followRows.length > 0,
        bio: profile?.bio ?? null,
        bannerPath: profile?.bannerPath ?? null,
      };
    }),

  // Bio + banner (side table). Display name and avatar go through
  // better-auth's updateUser on the client instead.
  updateProfile: protectedProcedure
    .input(
      z.object({
        bio: z.string().trim().max(300),
        // ImageKit filePath of a freshly uploaded banner; omitted = keep.
        bannerPath: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;
      const bio = input.bio || null;

      await db
        .insert(userProfile)
        .values({ userId, bio, bannerPath: input.bannerPath })
        .onConflictDoUpdate({
          target: userProfile.userId,
          set: {
            bio,
            ...(input.bannerPath ? { bannerPath: input.bannerPath } : {}),
          },
        });

      return { ok: true };
    }),

  setFollow: protectedProcedure
    .input(z.object({ userId: z.string().min(1), followed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const followerId = ctx.session.user.id;

      if (followerId === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "You can't follow yourself",
        });
      }

      if (input.followed) {
        // Composite PK makes double-follows a no-op; only a real insert
        // touches the denormalized counters.
        const inserted = await db
          .insert(follow)
          .values({ followerId, followeeId: input.userId })
          .onConflictDoNothing()
          .returning({ followerId: follow.followerId });
        if (inserted.length > 0) {
          // Both counters in one batch — atomic on the Neon HTTP driver.
          await db.batch([
            db
              .insert(userStats)
              .values({ userId: input.userId, followerCount: 1 })
              .onConflictDoUpdate({
                target: userStats.userId,
                set: {
                  followerCount: sql`${userStats.followerCount} + 1`,
                },
              }),
            db
              .insert(userStats)
              .values({ userId: followerId, followingCount: 1 })
              .onConflictDoUpdate({
                target: userStats.userId,
                set: {
                  followingCount: sql`${userStats.followingCount} + 1`,
                },
              }),
          ]);
        }
      } else {
        const deleted = await db
          .delete(follow)
          .where(
            and(
              eq(follow.followerId, followerId),
              eq(follow.followeeId, input.userId),
            ),
          )
          .returning({ followerId: follow.followerId });
        if (deleted.length > 0) {
          await db.batch([
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
              .where(eq(userStats.userId, followerId)),
          ]);
        }
      }

      return { followed: input.followed };
    }),
});
