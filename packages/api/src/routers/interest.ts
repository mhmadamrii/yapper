import { createDb } from '@yapper/db';
import { interest, userInterest } from '@yapper/db/schema/interest';
import { post } from '@yapper/db/schema/post';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../index';
import { getViewerExclusions } from '../lib/social-filters';
import { hydratePosts } from './post';

export const interestRouter = router({
  // The full catalog, curated order — small and static, no pagination.
  list: publicProcedure.query(() =>
    createDb()
      .select({ slug: interest.slug, name: interest.name })
      .from(interest)
      .orderBy(asc(interest.order)),
  ),

  // The viewer's saved interest slugs.
  mine: protectedProcedure.query(async ({ ctx }) => {
    const rows = await createDb()
      .select({ slug: userInterest.interestSlug })
      .from(userInterest)
      .where(eq(userInterest.userId, ctx.session.user.id));
    return rows.map((row) => row.slug);
  }),

  // Full replace, not a merge — a deselected interest has to disappear,
  // which an upsert wouldn't do. Used by both onboarding and the "Your
  // interests" settings page.
  setMine: protectedProcedure
    .input(z.object({ interestSlugs: z.array(z.string().min(1)).max(24) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;

      await db.transaction(async (tx) => {
        await tx.delete(userInterest).where(eq(userInterest.userId, userId));
        if (input.interestSlugs.length > 0) {
          await tx.insert(userInterest).values(
            input.interestSlugs.map((interestSlug) => ({
              userId,
              interestSlug,
            })),
          );
        }
      });

      return { count: input.interestSlugs.length };
    }),

  // Posts tagged with one of the given interests, reverse-chronological.
  // Mirrors `trendingRouter.posts`'s shape: block/mute filtered, keyset
  // paginated, hydrated in one IN-query.
  posts: publicProcedure
    .input(
      z.object({
        interestSlugs: z.array(z.string().min(1)).min(1).max(24),
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const { cursor, limit, interestSlugs } = input;
      const { feedExcluded } = await getViewerExclusions(
        db,
        ctx.session?.user.id,
      );

      const rows = await db
        .select({ id: post.id, createdAt: post.createdAt })
        .from(post)
        .where(
          and(
            inArray(post.interestSlug, interestSlugs),
            isNull(post.replyToPostId),
            isNull(post.communityId),
            feedExcluded.size > 0
              ? notInArray(post.authorId, [...feedExcluded])
              : undefined,
            cursor
              ? or(
                  lt(post.createdAt, new Date(cursor.createdAt)),
                  and(
                    eq(post.createdAt, new Date(cursor.createdAt)),
                    lt(post.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(post.createdAt), desc(post.id))
        .limit(limit + 1);

      let nextCursor: { createdAt: string; id: string } | null = null;
      if (rows.length > limit) {
        rows.pop();
        const last = rows[rows.length - 1]!;
        nextCursor = { createdAt: last.createdAt.toISOString(), id: last.id };
      }

      const items = await hydratePosts(
        db,
        rows.map((row) => row.id),
        ctx.session?.user.id,
      );

      return { items, nextCursor };
    }),

  // "Trending" card on the Explore page: the viewer's own top posts by raw
  // like count within a recent window, not a full velocity/decay score like
  // `trendingRouter` computes for hashtags. That algorithm earns its
  // complexity at hashtag scale (thousands of mentions/day, one topic
  // needing to outrank another that's always popular); at per-account
  // interest-post volume, a plain "most-liked lately" read is simpler and,
  // with so few posts to rank, no less meaningful.
  topPosts: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(10).default(5) }))
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;

      const mySlugs = await db
        .select({ slug: userInterest.interestSlug })
        .from(userInterest)
        .where(eq(userInterest.userId, userId));
      if (mySlugs.length === 0) return [];

      const { feedExcluded } = await getViewerExclusions(db, userId);

      const TRENDING_WINDOW_HOURS = 48;
      const rows = await db
        .select({ id: post.id })
        .from(post)
        .where(
          and(
            inArray(
              post.interestSlug,
              mySlugs.map((row) => row.slug),
            ),
            isNull(post.replyToPostId),
            isNull(post.communityId),
            sql`${post.createdAt} >= now() - make_interval(hours => ${TRENDING_WINDOW_HOURS})`,
            feedExcluded.size > 0
              ? notInArray(post.authorId, [...feedExcluded])
              : undefined,
          ),
        )
        .orderBy(desc(post.likeCount), desc(post.id))
        .limit(input.limit);

      // hydratePosts restores this exact (like-count) order — it isn't
      // re-sorting by anything of its own.
      return hydratePosts(
        db,
        rows.map((row) => row.id),
        userId,
      );
    }),
});
