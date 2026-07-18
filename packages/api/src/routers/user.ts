import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { userStats } from '@yapper/db/schema/social';
import { z } from 'zod';

import { publicProcedure, router } from '../index';

export const userRouter = router({
  byId: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = createDb();

      const [found, stats] = await Promise.all([
        db.query.user.findFirst({
          where: eq(user.id, input.id),
          columns: {
            id: true,
            name: true,
            username: true,
            displayUsername: true,
            image: true,
            createdAt: true,
          },
        }),
        db.query.userStats.findFirst({
          where: eq(userStats.userId, input.id),
        }),
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
      };
    }),
});
