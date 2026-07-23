import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { draftMedia, postDraft } from '@yapper/db/schema/draft';
import { post } from '@yapper/db/schema/post';
import { z } from 'zod';

import { getViewerExclusions } from '../lib/social-filters';
import { notify } from '../lib/notifications';
import { protectedProcedure, router } from '../index';
import { buildPostInsertStatements, mediaInput } from './post';

function draftNeedsContentOrMedia(content: string, media: unknown[]) {
  if (content.trim().length === 0 && media.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Draft needs content or an image',
    });
  }
}

export const draftRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = createDb();
    return db.query.postDraft.findMany({
      where: eq(postDraft.authorId, ctx.session.user.id),
      orderBy: (row, { desc }) => [desc(row.updatedAt), desc(row.id)],
      with: {
        media: {
          orderBy: (media, { asc }) => [asc(media.position)],
        },
        replyTo: {
          columns: { id: true, content: true },
          with: {
            author: {
              columns: {
                name: true,
                username: true,
                displayUsername: true,
                image: true,
              },
            },
          },
        },
      },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        content: z.string().max(300),
        media: z.array(mediaInput).max(4).default([]),
        replyToPostId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      draftNeedsContentOrMedia(input.content, input.media);

      const db = createDb();
      const draftId = crypto.randomUUID();

      const insertDraft = db.insert(postDraft).values({
        id: draftId,
        authorId: ctx.session.user.id,
        content: input.content,
        replyToPostId: input.replyToPostId,
      });

      if (input.media.length > 0) {
        await db.batch([
          insertDraft,
          db.insert(draftMedia).values(
            input.media.map((m, i) => ({
              draftId,
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
        await insertDraft;
      }

      return { id: draftId };
    }),

  // Content/media only — a draft's replyToPostId is set once at creation
  // and doesn't change on edit.
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        content: z.string().max(300),
        media: z.array(mediaInput).max(4).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      draftNeedsContentOrMedia(input.content, input.media);

      const db = createDb();
      const updated = await db
        .update(postDraft)
        .set({ content: input.content })
        .where(
          and(
            eq(postDraft.id, input.id),
            eq(postDraft.authorId, ctx.session.user.id),
          ),
        )
        .returning({ id: postDraft.id });

      if (updated.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });
      }

      const deleteMedia = db
        .delete(draftMedia)
        .where(eq(draftMedia.draftId, input.id));

      if (input.media.length > 0) {
        await db.batch([
          deleteMedia,
          db.insert(draftMedia).values(
            input.media.map((m, i) => ({
              draftId: input.id,
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
        await deleteMedia;
      }

      return { id: input.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const deleted = await db
        .delete(postDraft)
        .where(
          and(
            eq(postDraft.id, input.id),
            eq(postDraft.authorId, ctx.session.user.id),
          ),
        )
        .returning({ id: postDraft.id });

      if (deleted.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });
      }

      return { id: input.id };
    }),

  publish: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();

      const draft = await db.query.postDraft.findFirst({
        where: and(
          eq(postDraft.id, input.id),
          eq(postDraft.authorId, ctx.session.user.id),
        ),
        with: {
          media: { orderBy: (media, { asc }) => [asc(media.position)] },
        },
      });
      if (!draft) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Draft not found' });
      }
      if (draft.content.trim().length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Add some text before publishing — posts need content, even with an image attached',
        });
      }

      let parentAuthorId: string | undefined;
      if (draft.replyToPostId) {
        const parent = await db.query.post.findFirst({
          where: eq(post.id, draft.replyToPostId),
          columns: { authorId: true },
        });
        if (!parent) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'The post this was replying to no longer exists',
          });
        }
        const { blocked } = await getViewerExclusions(db, ctx.session.user.id);
        if (blocked.has(parent.authorId)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: "You can't reply to this post",
          });
        }
        parentAuthorId = parent.authorId;
      }

      const postId = crypto.randomUUID();
      await db.batch([
        ...buildPostInsertStatements(db, {
          postId,
          authorId: ctx.session.user.id,
          content: draft.content,
          media: draft.media.map((m) => ({
            fileId: m.fileId,
            filePath: m.filePath,
            width: m.width,
            height: m.height,
            format: m.format,
            bytes: m.bytes,
            altText: m.altText ?? undefined,
          })),
          replyToPostId: draft.replyToPostId ?? undefined,
        }),
        db.delete(postDraft).where(eq(postDraft.id, input.id)),
      ]);

      if (draft.replyToPostId && parentAuthorId) {
        await notify(db, {
          recipientId: parentAuthorId,
          actorId: ctx.session.user.id,
          type: 'reply',
          postId: draft.replyToPostId,
        });
      }

      return { id: postId };
    }),
});
