import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { like, save } from '@yapper/db/schema/engagement';
import { post, postMedia } from '@yapper/db/schema/post';
import { follow, userStats } from '@yapper/db/schema/social';
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../index';

import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';

const mediaInput = z.object({
  fileId: z.string().min(1),
  filePath: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().min(1),
  bytes: z.number().int().positive(),
  altText: z.string().max(1000).optional(),
});

// One IN-query each per page for the viewer's likes/saves — never a
// per-post lookup.
async function viewerEngagement(
  db: ReturnType<typeof createDb>,
  userId: string | undefined,
  postIds: string[],
) {
  if (!userId || postIds.length === 0) {
    return { liked: new Set<string>(), saved: new Set<string>() };
  }
  const [likeRows, saveRows] = await Promise.all([
    db
      .select({ postId: like.postId })
      .from(like)
      .where(and(eq(like.userId, userId), inArray(like.postId, postIds))),
    db
      .select({ postId: save.postId })
      .from(save)
      .where(and(eq(save.userId, userId), inArray(save.postId, postIds))),
  ]);
  return {
    liked: new Set(likeRows.map((row) => row.postId)),
    saved: new Set(saveRows.map((row) => row.postId)),
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
                image: true,
              },
            },
            media: {
              orderBy: (media, { asc }) => [asc(media.position)],
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
        // Keyset cursor: (createdAt, id) of the last item of the previous
        // page — never OFFSET.
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const cursor = input.cursor;

      const rows = await db.query.post.findMany({
        // Top-level posts only — replies live on the post detail page.
        where: and(
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
              image: true,
            },
          },
          media: {
            orderBy: (media, { asc }) => [asc(media.position)],
          },
        },
      });

      let nextCursor: { createdAt: string; id: string } | null = null;
      if (rows.length > input.limit) {
        rows.pop();
        const last = rows[rows.length - 1]!;
        nextCursor = {
          createdAt: last.createdAt.toISOString(),
          id: last.id,
        };
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
              image: true,
            },
          },
          media: {
            orderBy: (media, { asc }) => [asc(media.position)],
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

      if (!found) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });
      }

      const viewerId = ctx.session?.user.id;
      const [engagement, followRows] = await Promise.all([
        viewerEngagement(db, viewerId, [
          found.id,
          ...found.replies.map((reply) => reply.id),
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
        replies: found.replies.map((reply) => ({
          ...reply,
          likedByMe: engagement.liked.has(reply.id),
          savedByMe: engagement.saved.has(reply.id),
        })),
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        content: z.string().trim().min(1).max(300),
        media: z.array(mediaInput).max(4).default([]),
        replyToPostId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const postId = crypto.randomUUID();

      const statements = [
        db.insert(post).values({
          id: postId,
          authorId: ctx.session.user.id,
          content: input.content,
          replyToPostId: input.replyToPostId,
        }),
      ] as const;

      // Neon HTTP driver has no interactive transactions; batch executes
      // all statements atomically in a single request.
      const extras = [];
      if (input.media.length > 0) {
        extras.push(
          db.insert(postMedia).values(
            input.media.map((m, i) => ({
              postId,
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
      if (input.replyToPostId) {
        extras.push(
          db
            .update(post)
            .set({ replyCount: sql`${post.replyCount} + 1` })
            .where(eq(post.id, input.replyToPostId)),
        );
      }
      // Denormalized per-user post count; stats row created lazily.
      extras.push(
        db
          .insert(userStats)
          .values({ userId: ctx.session.user.id, postCount: 1 })
          .onConflictDoUpdate({
            target: userStats.userId,
            set: { postCount: sql`${userStats.postCount} + 1` },
          }),
      );

      await db.batch([statements[0], ...extras]);

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
                image: true,
              },
            },
            media: {
              orderBy: (media, { asc }) => [asc(media.position)],
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
          await db
            .update(post)
            .set({ likeCount: sql`${post.likeCount} + 1` })
            .where(eq(post.id, input.postId));
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
});
