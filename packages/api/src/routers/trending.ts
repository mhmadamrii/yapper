import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { hashtagMention } from '@yapper/db/schema/trending';
import { and, desc, eq, lt, notInArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../index';
import { normalizeHashtag } from '../lib/hashtags';
import { computeTrending, getTrending } from '../lib/trending';
import { getViewerExclusions } from '../lib/social-filters';
import { hydratePosts } from './post';

export const trendingRouter = router({
  /**
   * The sidebar list. Reads the precomputed snapshot — a ~10-row table with
   * a PK order — so this costs the same whether the app has 100 posts or
   * 100 million. All the ranking work happened in the 5-minute cron.
   *
   * Tags come back bare and lowercase (`mariners`). Whether the UI renders
   * '#mariners' or 'Mariners' is a display decision, deliberately not baked
   * into storage.
   */
  list: publicProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(10).default(5) })
        .default({ limit: 5 }),
    )
    .query(({ input }) => getTrending(createDb(), input.limit)),

  /**
   * Tag page: posts carrying a hashtag, reverse-chronological.
   *
   * Pages over `hashtag_mention` rather than scanning `post` for a LIKE
   * pattern — the (hashtag, createdAt desc) index turns this into a range
   * scan, and one row per (tag, post) means no dedupe is needed.
   *
   * Blocks and mutes are filtered here in SQL, not on the client. The
   * denormalized `authorId` on the mention row is what makes that possible
   * without joining `post` — the same column the cron needs.
   */
  posts: publicProcedure
    .input(
      z.object({
        hashtag: z.string().min(1).max(80),
        limit: z.number().int().min(1).max(50).default(20),
        // Keyset cursor: (createdAt, postId) of the last row of the previous
        // page. Unlike the "hot" feed's computed score, this sort key is
        // immutable, so pagination here is exactly stable.
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const hashtag = normalizeHashtag(input.hashtag);
      if (!hashtag) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid hashtag',
        });
      }

      const db = createDb();
      const { cursor, limit } = input;
      const { feedExcluded } = await getViewerExclusions(
        db,
        ctx.session?.user.id,
      );

      // Phase 1: page the mention index. Fetch limit + 1 to learn whether a
      // next page exists without a second COUNT query.
      const mentions = await db
        .select({
          postId: hashtagMention.postId,
          createdAt: hashtagMention.createdAt,
        })
        .from(hashtagMention)
        .where(
          and(
            eq(hashtagMention.hashtag, hashtag),
            feedExcluded.size > 0
              ? notInArray(hashtagMention.authorId, [...feedExcluded])
              : undefined,
            cursor
              ? or(
                  lt(hashtagMention.createdAt, new Date(cursor.createdAt)),
                  and(
                    eq(hashtagMention.createdAt, new Date(cursor.createdAt)),
                    lt(hashtagMention.postId, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(hashtagMention.createdAt), desc(hashtagMention.postId))
        .limit(limit + 1);

      let nextCursor: { createdAt: string; id: string } | null = null;
      if (mentions.length > limit) {
        mentions.pop();
        const last = mentions[mentions.length - 1]!;
        nextCursor = {
          createdAt: last.createdAt.toISOString(),
          id: last.postId,
        };
      }

      // Phase 2: hydrate in one IN-query, order restored from phase 1.
      const items = await hydratePosts(
        db,
        mentions.map((row) => row.postId),
        ctx.session?.user.id,
      );

      return { items, nextCursor };
    }),

  /**
   * Manual recompute trigger. The real trigger is the Worker's `scheduled`
   * handler on a 5-min Cloudflare Cron (see `apps/server/src/index.ts`),
   * which never fires in local dev — this lets the snapshot be rebuilt
   * on demand instead of waiting for a deploy.
   */
  recompute: protectedProcedure.mutation(() => computeTrending()),
});
