import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { draftMedia, postDraft } from '@yapper/db/schema/draft';
import { post } from '@yapper/db/schema/post';
import { z } from 'zod';

import { getViewerExclusions } from '../lib/social-filters';
import { notify } from '../lib/notifications';
import { protectedProcedure, router } from '../index';
import { buildPostInsertStatements, communityAccess, mediaInput } from './post';

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
        community: { columns: { id: true, name: true, coverKey: true } },
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
        interestSlug: z.string().min(1).optional(),
        communityId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      draftNeedsContentOrMedia(input.content, input.media);

      const db = createDb();
      const draftId = crypto.randomUUID();

      const draftValues = {
        id: draftId,
        authorId: ctx.session.user.id,
        content: input.content,
        replyToPostId: input.replyToPostId,
        interestSlug: input.interestSlug,
        communityId: input.communityId,
      };

      if (input.media.length > 0) {
        await db.transaction(async (tx) => {
          await tx.insert(postDraft).values(draftValues);
          await tx.insert(draftMedia).values(
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
          );
        });
      } else {
        await db.insert(postDraft).values(draftValues);
      }

      return { id: draftId };
    }),

  // Content/media/interest/community only — a draft's replyToPostId is set
  // once at creation and doesn't change on edit. `interestSlug` is nullable
  // rather than optional (like `content`, always sent in full) so picking
  // "General" explicitly clears a previously-set topic instead of leaving it
  // untouched — drizzle's `.set()` skips `undefined` fields but honors an
  // explicit `null`. `communityId` follows the same rule, except omitting it
  // leaves the stored value alone (reply drafts never send it).
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        content: z.string().max(300),
        media: z.array(mediaInput).max(4).default([]),
        interestSlug: z.string().min(1).nullable(),
        communityId: z.string().min(1).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      draftNeedsContentOrMedia(input.content, input.media);

      const db = createDb();
      const updated = await db
        .update(postDraft)
        .set({
          content: input.content,
          interestSlug: input.interestSlug,
          communityId: input.communityId,
        })
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

      if (input.media.length > 0) {
        await db.transaction(async (tx) => {
          await tx.delete(draftMedia).where(eq(draftMedia.draftId, input.id));
          await tx.insert(draftMedia).values(
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
          );
        });
      } else {
        await db.delete(draftMedia).where(eq(draftMedia.draftId, input.id));
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

      // Replies live in their parent's community, same rule as post.create.
      let communityId: string | undefined = draft.communityId ?? undefined;

      let parentAuthorId: string | undefined;
      if (draft.replyToPostId) {
        const parent = await db.query.post.findFirst({
          where: eq(post.id, draft.replyToPostId),
          columns: { authorId: true, communityId: true },
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
        communityId = parent.communityId ?? undefined;
      }

      // Membership can lapse between saving and publishing a draft.
      if (communityId) {
        const access = await communityAccess(
          db,
          communityId,
          ctx.session.user.id,
        );
        if (!access?.isMember) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Join this community to post in it',
          });
        }
      }

      const postId = crypto.randomUUID();
      await db.transaction(async (tx) => {
        const statements = buildPostInsertStatements(tx, {
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
          interestSlug: draft.interestSlug ?? undefined,
          communityId,
        });
        for (const statement of statements) {
          await statement;
        }
        await tx.delete(postDraft).where(eq(postDraft.id, input.id));
      });

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
