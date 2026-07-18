import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { like } from '@yapper/db/schema/engagement';
import { post, postMedia } from '@yapper/db/schema/post';
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../index';

const mediaInput = z.object({
  fileId: z.string().min(1),
  filePath: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().min(1),
  bytes: z.number().int().positive(),
  altText: z.string().max(1000).optional(),
});

// One IN-query per page for the viewer's likes — never a per-post lookup.
async function likedPostIds(
  db: ReturnType<typeof createDb>,
  userId: string | undefined,
  postIds: string[],
) {
  if (!userId || postIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ postId: like.postId })
    .from(like)
    .where(and(eq(like.userId, userId), inArray(like.postId, postIds)));
  return new Set(rows.map((row) => row.postId));
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

      const liked = await likedPostIds(
        db,
        ctx.session?.user.id,
        rows.map((row) => row.id),
      );
      const items = rows.map((row) => ({
        ...row,
        likedByMe: liked.has(row.id),
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

      const liked = await likedPostIds(db, ctx.session?.user.id, [
        found.id,
        ...found.replies.map((reply) => reply.id),
      ]);

      return {
        ...found,
        likedByMe: liked.has(found.id),
        replies: found.replies.map((reply) => ({
          ...reply,
          likedByMe: liked.has(reply.id),
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

      if (extras.length > 0) {
        await db.batch([statements[0], ...extras]);
      } else {
        await statements[0];
      }

      return { id: postId };
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
