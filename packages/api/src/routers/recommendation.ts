import { createDb } from '@yapper/db';
import { protectedProcedure, router } from '../index';
import { z } from 'zod';

import {
  DEFAULT_RECOMMENDATION_LIMIT,
  getFollowRecommendations,
} from '../lib/follow-recommendations';

export const recommendationRouter = router({
  // "People you might know". tRPC query == GET; the client calls this as
  // trpc.recommendation.follows.queryOptions({ limit }).
  follows: protectedProcedure
    .input(
      z
        .object({
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .default(DEFAULT_RECOMMENDATION_LIMIT),
        })
        .default({ limit: DEFAULT_RECOMMENDATION_LIMIT }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      return getFollowRecommendations(db, ctx.session.user.id, input.limit);
    }),
});
