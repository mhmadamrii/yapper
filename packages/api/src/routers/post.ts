import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { like, repost, save } from '@yapper/db/schema/engagement';
import { post, postMedia } from '@yapper/db/schema/post';
import { follow, userStats } from '@yapper/db/schema/social';
import { z } from 'zod';
import { getViewerExclusions } from '../lib/social-filters';
import { notify } from '../lib/notifications';
import { protectedProcedure, publicProcedure, router } from '../index';

import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';

export const mediaInput = z.object({
  fileId: z.string().min(1),
  filePath: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().min(1),
  bytes: z.number().int().positive(),
  altText: z.string().max(1000).optional(),
});

// Shared by post.create and draft.publish (converting a draft into a real
// post) — Neon HTTP driver has no interactive transactions, so the caller
// runs this via db.batch for atomicity.
export function buildPostInsertStatements(
  db: ReturnType<typeof createDb>,
  args: {
    postId: string;
    authorId: string;
    content: string;
    media: Array<{
      fileId: string;
      filePath: string;
      width: number;
      height: number;
      format: string;
      bytes: number;
      altText?: string;
    }>;
    replyToPostId?: string;
    quotedPostId?: string;
  },
) {
  const insertPost = db.insert(post).values({
    id: args.postId,
    authorId: args.authorId,
    content: args.content,
    replyToPostId: args.replyToPostId,
    quotedPostId: args.quotedPostId,
  });

  const extras = [];
  if (args.media.length > 0) {
    extras.push(
      db.insert(postMedia).values(
        args.media.map((m, i) => ({
          postId: args.postId,
          fileId: m.fileId,
          filePath: m.filePath,
          width: m.width,
          height: m.height,
          format: m.format,
          bytes: m.bytes,
          altText: m.altText,
          position: i,
        })),
      ),
    );
  }
  if (args.replyToPostId) {
    extras.push(
      db
        .update(post)
        .set({ replyCount: sql`${post.replyCount} + 1` })
        .where(eq(post.id, args.replyToPostId)),
    );
  }
  // Quote posts count toward the quoted post's repostCount, same as
  // X/Bluesky combine plain reposts and quotes into one count.
  if (args.quotedPostId) {
    extras.push(
      db
        .update(post)
        .set({ repostCount: sql`${post.repostCount} + 1` })
        .where(eq(post.id, args.quotedPostId)),
    );
  }
  // Denormalized per-user post count; stats row created lazily.
  extras.push(
    db
      .insert(userStats)
      .values({ userId: args.authorId, postCount: 1 })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: { postCount: sql`${userStats.postCount} + 1` },
      }),
  );

  return [insertPost, ...extras] as const;
}

// Non-personalized "hot" ranking for the global feed: log-dampened
// engagement (so viral posts don't dominate forever) minus a linear
// time-decay penalty (so freshness always eventually wins). Computed at
// read time from existing denormalized counters — no precompute, no cron.
// Higher RANK_TIME_DECAY_HOURS = engagement matters more relative to age.
const RANK_TIME_DECAY_HOURS = 12;
const postAgeHours = sql`extract(epoch from (now() - ${post.createdAt})) / 3600.0`;
const postEngagement = sql`(${post.likeCount} + ${post.repostCount} + ${post.replyCount})`;
const rankScore = sql<number>`ln(1 + ${postEngagement}) - (${postAgeHours}) / ${RANK_TIME_DECAY_HOURS}`;

// One IN-query each per page for the viewer's likes/saves/reposts — never a
// per-post lookup.
async function viewerEngagement(
  db: ReturnType<typeof createDb>,
  userId: string | undefined,
  postIds: string[],
) {
  if (!userId || postIds.length === 0) {
    return {
      liked: new Set<string>(),
      saved: new Set<string>(),
      reposted: new Set<string>(),
    };
  }
  const [likeRows, saveRows, repostRows] = await Promise.all([
    db
      .select({ postId: like.postId })
      .from(like)
      .where(and(eq(like.userId, userId), inArray(like.postId, postIds))),
    db
      .select({ postId: save.postId })
      .from(save)
      .where(and(eq(save.userId, userId), inArray(save.postId, postIds))),
    db
      .select({ postId: repost.postId })
      .from(repost)
      .where(and(eq(repost.userId, userId), inArray(repost.postId, postIds))),
  ]);
  return {
    liked: new Set(likeRows.map((row) => row.postId)),
    saved: new Set(saveRows.map((row) => row.postId)),
    reposted: new Set(repostRows.map((row) => row.postId)),
  };
}

// Page over a user's engagement rows (like/save) — their createdAt is the
// keyset sort key — then hydrate the posts in one IN-query and restore order.
async function pageEngagedPosts(
  db: ReturnType<typeof createDb>,
  table: typeof like | typeof save,
  userId: string,
  limit: number,
  cursor: { createdAt: string; id: string } | null | undefined,
) {
  const engagementRows = await db
    .select({ postId: table.postId, createdAt: table.createdAt })
    .from(table)
    .where(
      and(
        eq(table.userId, userId),
        cursor
          ? or(
              lt(table.createdAt, new Date(cursor.createdAt)),
              and(
                eq(table.createdAt, new Date(cursor.createdAt)),
                lt(table.postId, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(table.createdAt), desc(table.postId))
    .limit(limit + 1);

  let nextCursor: { createdAt: string; id: string } | null = null;
  if (engagementRows.length > limit) {
    engagementRows.pop();
    const last = engagementRows[engagementRows.length - 1]!;
    nextCursor = {
      createdAt: last.createdAt.toISOString(),
      id: last.postId,
    };
  }

  const ids = engagementRows.map((row) => row.postId);
  const posts =
    ids.length === 0
      ? []
      : await db.query.post.findMany({
          where: inArray(post.id, ids),
          with: {
            author: {
              columns: {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                emailVerified: true,
                image: true,
              },
            },
            media: {
              orderBy: (media, { asc }) => [asc(media.position)],
            },
            quotedPost: {
              with: {
                author: {
                  columns: {
                    id: true,
                    name: true,
                    username: true,
                    displayUsername: true,
                    emailVerified: true,
                    image: true,
                  },
                },
                media: {
                  orderBy: (media, { asc }) => [asc(media.position)],
                },
              },
            },
          },
        });
  const byId = new Map(posts.map((row) => [row.id, row]));
  const rows = ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row != null);

  return { rows, nextCursor };
}

export const postRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        // Keyset cursor: (score, id) of the last item of the previous
        // page — never OFFSET. Score is computed at read time (see
        // rankScore above), so this pagination is only approximately
        // stable across requests (the same trade-off HN/Reddit's "hot"
        // ranking makes) — acceptable drift for a social feed.
        cursor: z.object({ score: z.number(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const cursor = input.cursor;
      const { feedExcluded } = await getViewerExclusions(
        db,
        ctx.session?.user.id,
      );

      // Phase 1: rank. A computed expression can't reliably drive `where`
      // and `orderBy` through the relational query builder, so rank with
      // a plain select first, then hydrate relations in phase 2 — same
      // two-phase shape as pageEngagedPosts above.
      const rankedRows = await db
        .select({ id: post.id, score: rankScore })
        .from(post)
        .where(
          and(
            isNull(post.replyToPostId),
            feedExcluded.size > 0
              ? notInArray(post.authorId, [...feedExcluded])
              : undefined,
            cursor
              ? or(
                  sql`${rankScore} < ${cursor.score}`,
                  and(
                    sql`${rankScore} = ${cursor.score}`,
                    lt(post.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(sql`${rankScore} desc`, desc(post.id))
        .limit(input.limit + 1);

      let nextCursor: { score: number; id: string } | null = null;
      if (rankedRows.length > input.limit) {
        rankedRows.pop();
        const last = rankedRows[rankedRows.length - 1]!;
        nextCursor = { score: last.score, id: last.id };
      }

      // Phase 2: hydrate relations, then restore rank order (IN-queries
      // don't preserve input order).
      const ids = rankedRows.map((row) => row.id);
      const posts =
        ids.length === 0
          ? []
          : await db.query.post.findMany({
              where: inArray(post.id, ids),
              with: {
                author: {
                  columns: {
                    id: true,
                    name: true,
                    username: true,
                    displayUsername: true,
                    emailVerified: true,
                    image: true,
                  },
                },
                media: {
                  orderBy: (media, { asc }) => [asc(media.position)],
                },
                quotedPost: {
                  with: {
                    author: {
                      columns: {
                        id: true,
                        name: true,
                        username: true,
                        displayUsername: true,
                        emailVerified: true,
                        image: true,
                      },
                    },
                    media: {
                      orderBy: (media, { asc }) => [asc(media.position)],
                    },
                  },
                },
              },
            });
      const byId = new Map(posts.map((row) => [row.id, row]));
      const rows = ids
        .map((id) => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => row != null);

      const engagement = await viewerEngagement(
        db,
        ctx.session?.user.id,
        rows.map((row) => row.id),
      );
      const items = rows.map((row) => ({
        ...row,
        likedByMe: engagement.liked.has(row.id),
        savedByMe: engagement.saved.has(row.id),
        repostedByMe: engagement.reposted.has(row.id),
      }));

      return { items, nextCursor };
    }),

  // Following tab: reverse-chronological, fan-out-on-read from the `follow`
  // table (its PK is (followerId, followeeId), covering exactly this query).
  // Fan-out-on-write (precomputed per-follower timelines) would pay off at
  // scale with high-follow-count accounts, but reads-at-write-time is the
  // wrong trade here — portfolio-scale write volume, and simplicity wins.
  listFollowing: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const viewerId = ctx.session.user.id;
      const cursor = input.cursor;

      const { feedExcluded } = await getViewerExclusions(db, viewerId);

      const followeeRows = await db
        .select({ followeeId: follow.followeeId })
        .from(follow)
        .where(eq(follow.followerId, viewerId));
      const followeeIds = followeeRows
        .map((row) => row.followeeId)
        .filter((id) => !feedExcluded.has(id));

      if (followeeIds.length === 0) {
        return { items: [], nextCursor: null };
      }

      const rows = await db.query.post.findMany({
        where: and(
          inArray(post.authorId, followeeIds),
          isNull(post.replyToPostId),
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
        orderBy: [desc(post.createdAt), desc(post.id)],
        limit: input.limit + 1,
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              emailVerified: true,
              image: true,
            },
          },
          media: {
            orderBy: (media, { asc }) => [asc(media.position)],
          },
          quotedPost: {
            with: {
              author: {
                columns: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  emailVerified: true,
                  image: true,
                },
              },
              media: {
                orderBy: (media, { asc }) => [asc(media.position)],
              },
            },
          },
        },
      });

      let nextCursor: { createdAt: string; id: string } | null = null;
      if (rows.length > input.limit) {
        rows.pop();
        const last = rows[rows.length - 1]!;
        nextCursor = { createdAt: last.createdAt.toISOString(), id: last.id };
      }

      const engagement = await viewerEngagement(
        db,
        viewerId,
        rows.map((row) => row.id),
      );
      const items = rows.map((row) => ({
        ...row,
        likedByMe: engagement.liked.has(row.id),
        savedByMe: engagement.saved.has(row.id),
        repostedByMe: engagement.reposted.has(row.id),
      }));

      return { items, nextCursor };
    }),

  byId: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        replySort: z.enum(['top', 'oldest', 'newest']).default('top'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();

      const found = await db.query.post.findFirst({
        where: eq(post.id, input.id),
        with: {
          author: {
            columns: {
              id: true,
              name: true,
              username: true,
              displayUsername: true,
              emailVerified: true,
              image: true,
            },
          },
          media: {
            orderBy: (media, { asc }) => [asc(media.position)],
          },
          // The embedded post, when this is a quote post.
          quotedPost: {
            with: {
              author: {
                columns: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  emailVerified: true,
                  image: true,
                },
              },
              media: {
                orderBy: (media, { asc }) => [asc(media.position)],
              },
            },
          },
          // Parent post, when this is a reply — the detail page renders it
          // above the focused post with a thread line.
          replyTo: {
            with: {
              author: {
                columns: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  emailVerified: true,
                  image: true,
                },
              },
              media: {
                orderBy: (media, { asc }) => [asc(media.position)],
              },
              quotedPost: {
                with: {
                  author: {
                    columns: {
                      id: true,
                      name: true,
                      username: true,
                      displayUsername: true,
                      emailVerified: true,
                      image: true,
                    },
                  },
                  media: {
                    orderBy: (media, { asc }) => [asc(media.position)],
                  },
                },
              },
            },
          },
          replies: {
            orderBy: (reply, { asc, desc }) =>
              input.replySort === 'top'
                ? [desc(reply.likeCount), desc(reply.createdAt)]
                : input.replySort === 'oldest'
                  ? [asc(reply.createdAt), asc(reply.id)]
                  : [desc(reply.createdAt), desc(reply.id)],
            with: {
              author: {
                columns: {
                  id: true,
                  name: true,
                  username: true,
                  displayUsername: true,
                  emailVerified: true,
                  image: true,
                },
              },
              media: {
                orderBy: (media, { asc }) => [asc(media.position)],
              },
              quotedPost: {
                with: {
                  author: {
                    columns: {
                      id: true,
                      name: true,
                      username: true,
                      displayUsername: true,
                      emailVerified: true,
                      image: true,
                    },
                  },
                  media: {
                    orderBy: (media, { asc }) => [asc(media.position)],
                  },
                },
              },
            },
          },
        },
      });

      if (!found) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }

      const viewerId = ctx.session?.user.id;
      const { blocked, feedExcluded } = await getViewerExclusions(db, viewerId);
      if (blocked.has(found.authorId)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }
      const visibleReplies = found.replies.filter(
        (reply) => !feedExcluded.has(reply.authorId),
      );

      const [engagement, followRows] = await Promise.all([
        viewerEngagement(db, viewerId, [
          found.id,
          ...(found.replyTo ? [found.replyTo.id] : []),
          ...visibleReplies.map((reply) => reply.id),
        ]),
        // Whether the viewer follows the post's author — drives the
        // Follow button on the detail page.
        viewerId && viewerId !== found.authorId
          ? db
              .select({ followerId: follow.followerId })
              .from(follow)
              .where(
                and(
                  eq(follow.followerId, viewerId),
                  eq(follow.followeeId, found.authorId),
                ),
              )
              .limit(1)
          : Promise.resolve([]),
      ]);

      return {
        ...found,
        author: { ...found.author, followedByMe: followRows.length > 0 },
        likedByMe: engagement.liked.has(found.id),
        savedByMe: engagement.saved.has(found.id),
        repostedByMe: engagement.reposted.has(found.id),
        replyTo: found.replyTo
          ? {
              ...found.replyTo,
              likedByMe: engagement.liked.has(found.replyTo.id),
              savedByMe: engagement.saved.has(found.replyTo.id),
              repostedByMe: engagement.reposted.has(found.replyTo.id),
            }
          : null,
        replies: visibleReplies.map((reply) => ({
          ...reply,
          likedByMe: engagement.liked.has(reply.id),
          savedByMe: engagement.saved.has(reply.id),
          repostedByMe: engagement.reposted.has(reply.id),
        })),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        content: z.string().trim().min(1).max(300),
        media: z.array(mediaInput).max(4).default([]),
        replyToPostId: z.string().min(1).optional(),
        quotedPostId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const postId = crypto.randomUUID();
      const { blocked } = await getViewerExclusions(db, ctx.session.user.id);

      let parentAuthorId: string | undefined;
      if (input.replyToPostId) {
        const parent = await db.query.post.findFirst({
          where: eq(post.id, input.replyToPostId),
          columns: { authorId: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Post not found',
          });
        }
        if (blocked.has(parent.authorId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: "You can't reply to this post",
          });
        }
        parentAuthorId = parent.authorId;
      }

      let quotedAuthorId: string | undefined;
      if (input.quotedPostId) {
        const quoted = await db.query.post.findFirst({
          where: eq(post.id, input.quotedPostId),
          columns: { authorId: true },
        });
        if (!quoted) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Post not found',
          });
        }
        if (blocked.has(quoted.authorId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: "You can't quote this post",
          });
        }
        quotedAuthorId = quoted.authorId;
      }

      await db.batch(
        buildPostInsertStatements(db, {
          postId,
          authorId: ctx.session.user.id,
          content: input.content,
          media: input.media,
          replyToPostId: input.replyToPostId,
          quotedPostId: input.quotedPostId,
        }),
      );

      if (input.replyToPostId && parentAuthorId) {
        await notify(db, {
          recipientId: parentAuthorId,
          actorId: ctx.session.user.id,
          type: 'reply',
          postId: input.replyToPostId,
        });
      }
      if (input.quotedPostId && quotedAuthorId) {
        await notify(db, {
          recipientId: quotedAuthorId,
          actorId: ctx.session.user.id,
          type: 'repost',
          postId: input.quotedPostId,
        });
      }

      return { id: postId };
    }),

  byUser: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        tab: z.enum(['posts', 'replies', 'likes', 'saved']).default('posts'),
        limit: z.number().int().min(1).max(50).default(20),
        // Keyset cursor. For posts/replies: (post.createdAt, post.id).
        // For likes/saved: (engagement.createdAt, postId).
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const { userId, tab, limit, cursor } = input;

      const { blocked } = await getViewerExclusions(db, ctx.session?.user.id);
      if (blocked.has(userId)) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      let rows: Awaited<ReturnType<typeof fetchAuthored>>;
      let nextCursor: { createdAt: string; id: string } | null = null;

      async function fetchAuthored() {
        return db.query.post.findMany({
          where: and(
            eq(post.authorId, userId),
            tab === 'posts'
              ? isNull(post.replyToPostId)
              : isNotNull(post.replyToPostId),
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
          orderBy: [desc(post.createdAt), desc(post.id)],
          limit: limit + 1,
          with: {
            author: {
              columns: {
                id: true,
                name: true,
                username: true,
                displayUsername: true,
                emailVerified: true,
                image: true,
              },
            },
            media: {
              orderBy: (media, { asc }) => [asc(media.position)],
            },
            quotedPost: {
              with: {
                author: {
                  columns: {
                    id: true,
                    name: true,
                    username: true,
                    displayUsername: true,
                    emailVerified: true,
                    image: true,
                  },
                },
                media: {
                  orderBy: (media, { asc }) => [asc(media.position)],
                },
              },
            },
          },
        });
      }

      if (tab === 'posts' || tab === 'replies') {
        rows = await fetchAuthored();
        if (rows.length > limit) {
          rows.pop();
          const last = rows[rows.length - 1]!;
          nextCursor = {
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          };
        }
      } else {
        const table = tab === 'likes' ? like : save;
        const paged = await pageEngagedPosts(db, table, userId, limit, cursor);
        rows = paged.rows;
        nextCursor = paged.nextCursor;
      }

      const engagement = await viewerEngagement(
        db,
        ctx.session?.user.id,
        rows.map((row) => row.id),
      );
      const items = rows.map((row) => ({
        ...row,
        likedByMe: engagement.liked.has(row.id),
        savedByMe: engagement.saved.has(row.id),
        repostedByMe: engagement.reposted.has(row.id),
      }));

      return { items, nextCursor };
    }),

  // The viewer's own bookmarks — protected because saves are private to
  // the account (unlike likes, which show on public profiles).
  saved: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        // Keyset cursor: (save.createdAt, postId) of the last item.
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;

      const { rows, nextCursor } = await pageEngagedPosts(
        db,
        save,
        userId,
        input.limit,
        input.cursor,
      );

      const engagement = await viewerEngagement(
        db,
        userId,
        rows.map((row) => row.id),
      );
      const items = rows.map((row) => ({
        ...row,
        likedByMe: engagement.liked.has(row.id),
        savedByMe: true,
        repostedByMe: engagement.reposted.has(row.id),
      }));

      return { items, nextCursor };
    }),

  setSave: protectedProcedure
    .input(z.object({ postId: z.string().min(1), saved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;

      if (input.saved) {
        await db
          .insert(save)
          .values({ userId, postId: input.postId })
          .onConflictDoNothing();
      } else {
        await db
          .delete(save)
          .where(and(eq(save.userId, userId), eq(save.postId, input.postId)));
      }

      return { saved: input.saved };
    }),

  setLike: protectedProcedure
    .input(z.object({ postId: z.string().min(1), liked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;

      if (input.liked) {
        // Composite PK makes double-likes a no-op; only a real insert
        // increments the denormalized counter.
        const inserted = await db
          .insert(like)
          .values({ userId, postId: input.postId })
          .onConflictDoNothing()
          .returning({ postId: like.postId });
        if (inserted.length > 0) {
          const [postRow] = await db
            .update(post)
            .set({ likeCount: sql`${post.likeCount} + 1` })
            .where(eq(post.id, input.postId))
            .returning({ authorId: post.authorId });
          if (postRow) {
            await notify(db, {
              recipientId: postRow.authorId,
              actorId: userId,
              type: 'like',
              postId: input.postId,
            });
          }
        }
      } else {
        const deleted = await db
          .delete(like)
          .where(and(eq(like.userId, userId), eq(like.postId, input.postId)))
          .returning({ postId: like.postId });
        if (deleted.length > 0) {
          await db
            .update(post)
            .set({ likeCount: sql`GREATEST(${post.likeCount} - 1, 0)` })
            .where(eq(post.id, input.postId));
        }
      }

      return { liked: input.liked };
    }),

  setRepost: protectedProcedure
    .input(z.object({ postId: z.string().min(1), reposted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;

      if (input.reposted) {
        // Composite PK makes double-reposts a no-op; only a real insert
        // increments the denormalized counter.
        const inserted = await db
          .insert(repost)
          .values({ userId, postId: input.postId })
          .onConflictDoNothing()
          .returning({ postId: repost.postId });
        if (inserted.length > 0) {
          const [postRow] = await db
            .update(post)
            .set({ repostCount: sql`${post.repostCount} + 1` })
            .where(eq(post.id, input.postId))
            .returning({ authorId: post.authorId });
          if (postRow) {
            await notify(db, {
              recipientId: postRow.authorId,
              actorId: userId,
              type: 'repost',
              postId: input.postId,
            });
          }
        }
      } else {
        const deleted = await db
          .delete(repost)
          .where(
            and(eq(repost.userId, userId), eq(repost.postId, input.postId)),
          )
          .returning({ postId: repost.postId });
        if (deleted.length > 0) {
          await db
            .update(post)
            .set({ repostCount: sql`GREATEST(${post.repostCount} - 1, 0)` })
            .where(eq(post.id, input.postId));
        }
      }

      return { reposted: input.reposted };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();

      const [deleted] = await db
        .delete(post)
        .where(
          and(eq(post.id, input.id), eq(post.authorId, ctx.session.user.id)),
        )
        .returning({ id: post.id, replyToPostId: post.replyToPostId });

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }

      if (deleted.replyToPostId) {
        await db
          .update(post)
          .set({ replyCount: sql`GREATEST(${post.replyCount} - 1, 0)` })
          .where(eq(post.id, deleted.replyToPostId));
      }
      await db
        .update(userStats)
        .set({ postCount: sql`GREATEST(${userStats.postCount} - 1, 0)` })
        .where(eq(userStats.userId, ctx.session.user.id));

      return { id: deleted.id };
    }),
});
