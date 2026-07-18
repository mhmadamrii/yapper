import { and, desc, eq, lt, or } from 'drizzle-orm';
import { createDb } from '@yapper/db';
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
    .query(async ({ input }) => {
      const db = createDb();
      const cursor = input.cursor;

      const rows = await db.query.post.findMany({
        where: cursor
          ? or(
              lt(post.createdAt, new Date(cursor.createdAt)),
              and(
                eq(post.createdAt, new Date(cursor.createdAt)),
                lt(post.id, cursor.id),
              ),
            )
          : undefined,
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

      return { items: rows, nextCursor };
    }),

  create: protectedProcedure
    .input(
      z.object({
        content: z.string().trim().min(1).max(300),
        media: z.array(mediaInput).max(4).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const postId = crypto.randomUUID();

      const insertPost = db.insert(post).values({
        id: postId,
        authorId: ctx.session.user.id,
        content: input.content,
      });

      if (input.media.length > 0) {
        // Neon HTTP driver has no interactive transactions; batch executes
        // both inserts atomically in a single request.
        await db.batch([
          insertPost,
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
        ]);
      } else {
        await insertPost;
      }

      return { id: postId };
    }),
});
