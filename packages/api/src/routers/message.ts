import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import {
  conversation,
  conversationParticipant,
  message,
} from '@yapper/db/schema/message';
import { z } from 'zod';

import { broadcastMessage } from '../lib/conversation-broadcast';
import { assertOwner, assertParticipant } from '../lib/message-auth';
import { getViewerExclusions } from '../lib/social-filters';
import { protectedProcedure, router } from '../index';

const userColumns = {
  id: true,
  name: true,
  username: true,
  displayUsername: true,
  image: true,
} as const;

export const messageRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        // Keyset cursor: (lastMessageAt, id) of the last item of the
        // previous page.
        cursor: z
          .object({ lastMessageAt: z.string(), id: z.string() })
          .nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session.user.id;
      const cursor = input.cursor;

      const rows = await db
        .select({
          id: conversation.id,
          isGroup: conversation.isGroup,
          name: conversation.name,
          image: conversation.image,
          lastMessagePreview: conversation.lastMessagePreview,
          lastMessageSenderId: conversation.lastMessageSenderId,
          lastMessageAt: conversation.lastMessageAt,
          lastReadAt: conversationParticipant.lastReadAt,
          myRole: conversationParticipant.role,
        })
        .from(conversationParticipant)
        .innerJoin(
          conversation,
          eq(conversation.id, conversationParticipant.conversationId),
        )
        .where(
          and(
            eq(conversationParticipant.userId, me),
            cursor
              ? or(
                  lt(
                    conversation.lastMessageAt,
                    new Date(cursor.lastMessageAt),
                  ),
                  and(
                    eq(
                      conversation.lastMessageAt,
                      new Date(cursor.lastMessageAt),
                    ),
                    lt(conversation.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(conversation.lastMessageAt), desc(conversation.id))
        .limit(input.limit + 1);

      let nextCursor: { lastMessageAt: string; id: string } | null = null;
      if (rows.length > input.limit) {
        rows.pop();
        const last = rows[rows.length - 1]!;
        nextCursor = {
          lastMessageAt: last.lastMessageAt.toISOString(),
          id: last.id,
        };
      }

      // Two-phase like notification.list's actor hydration: page the
      // conversation rows first, then batch-hydrate the other participant(s)
      // in one IN-query rather than a per-row join.
      const conversationIds = rows.map((row) => row.id);
      const peerRows =
        conversationIds.length === 0
          ? []
          : await db.query.conversationParticipant.findMany({
              where: and(
                inArray(
                  conversationParticipant.conversationId,
                  conversationIds,
                ),
                ne(conversationParticipant.userId, me),
              ),
              with: { user: { columns: userColumns } },
            });

      const peersByConversation = new Map<string, (typeof peerRows)[number]['user'][]>(); // prettier-ignore
      for (const row of peerRows) {
        const list = peersByConversation.get(row.conversationId) ?? [];
        list.push(row.user);
        peersByConversation.set(row.conversationId, list);
      }

      const items = rows.map((row) => ({
        id: row.id,
        isGroup: row.isGroup,
        name: row.name,
        image: row.image,
        lastMessagePreview: row.lastMessagePreview,
        lastMessageSenderId: row.lastMessageSenderId,
        lastMessageAt: row.lastMessageAt,
        hasUnread: !row.lastReadAt || row.lastReadAt < row.lastMessageAt,
        myRole: row.myRole,
        peers: peersByConversation.get(row.id) ?? [],
      }));

      return { items, nextCursor };
    }),

  thread: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(30),
        cursor: z.object({ createdAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      await assertParticipant(db, input.conversationId, ctx.session.user.id);
      const cursor = input.cursor;

      const rows = await db.query.message.findMany({
        where: and(
          eq(message.conversationId, input.conversationId),
          cursor
            ? or(
                lt(message.createdAt, new Date(cursor.createdAt)),
                and(
                  eq(message.createdAt, new Date(cursor.createdAt)),
                  lt(message.id, cursor.id),
                ),
              )
            : undefined,
        ),
        orderBy: (m, { desc }) => [desc(m.createdAt), desc(m.id)],
        limit: input.limit + 1,
        with: { sender: { columns: userColumns } },
      });

      let nextCursor: { createdAt: string; id: string } | null = null;
      if (rows.length > input.limit) {
        rows.pop();
        const oldest = rows[rows.length - 1]!;
        nextCursor = {
          createdAt: oldest.createdAt.toISOString(),
          id: oldest.id,
        };
      }

      return { items: rows.reverse(), nextCursor };
    }),

  send: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        body: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const senderId = ctx.session.user.id;
      await assertParticipant(db, input.conversationId, senderId);

      const id = crypto.randomUUID();
      const now = new Date();
      const preview = input.body.slice(0, 140);

      await db.batch([
        db.insert(message).values({
          id,
          conversationId: input.conversationId,
          senderId,
          body: input.body,
          createdAt: now,
        }),
        db
          .update(conversation)
          .set({
            lastMessageId: id,
            lastMessagePreview: preview,
            lastMessageSenderId: senderId,
            lastMessageAt: now,
          })
          .where(eq(conversation.id, input.conversationId)),
        db
          .update(conversationParticipant)
          .set({ lastReadAt: now, lastReadMessageId: id })
          .where(
            and(
              eq(conversationParticipant.conversationId, input.conversationId),
              eq(conversationParticipant.userId, senderId),
            ),
          ),
      ]);

      await broadcastMessage(input.conversationId, {
        id,
        conversationId: input.conversationId,
        senderId,
        body: input.body,
        createdAt: now.toISOString(),
        sender: {
          id: senderId,
          name: ctx.session.user.name,
          username: ctx.session.user.username ?? null,
          displayUsername: ctx.session.user.displayUsername ?? null,
          image: ctx.session.user.image ?? null,
        },
      });

      return { id, createdAt: now };
    }),

  markRead: protectedProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;
      await assertParticipant(db, input.conversationId, userId);

      const conv = await db.query.conversation.findFirst({
        where: eq(conversation.id, input.conversationId),
        columns: { lastMessageId: true },
      });

      await db
        .update(conversationParticipant)
        .set({
          lastReadAt: sql`now()`,
          lastReadMessageId: conv?.lastMessageId ?? null,
        })
        .where(
          and(
            eq(conversationParticipant.conversationId, input.conversationId),
            eq(conversationParticipant.userId, userId),
          ),
        );

      return { ok: true };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = createDb();
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversationParticipant)
      .innerJoin(
        conversation,
        eq(conversation.id, conversationParticipant.conversationId),
      )
      .where(
        and(
          eq(conversationParticipant.userId, ctx.session.user.id),
          or(
            isNull(conversationParticipant.lastReadAt),
            lt(conversationParticipant.lastReadAt, conversation.lastMessageAt),
          ),
        ),
      );

    return { count: Number(row?.count ?? 0) };
  }),

  createDirect: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session.user.id;

      if (me === input.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "You can't message yourself",
        });
      }

      const { blocked } = await getViewerExclusions(db, me);
      if (blocked.has(input.userId)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: "You can't message this user",
        });
      }

      const dmKey = [me, input.userId].sort().join(':');

      const inserted = await db
        .insert(conversation)
        .values({ isGroup: false, dmKey, createdById: me })
        .onConflictDoNothing({ target: conversation.dmKey })
        .returning({ id: conversation.id });

      if (inserted.length > 0) {
        const conversationId = inserted[0]!.id;
        await db.insert(conversationParticipant).values([
          { conversationId, userId: me, role: 'member' },
          { conversationId, userId: input.userId, role: 'member' },
        ]);
        return { conversationId };
      }

      const existing = await db.query.conversation.findFirst({
        where: eq(conversation.dmKey, dmKey),
        columns: { id: true },
      });

      return { conversationId: existing!.id };
    }),

  createGroup: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        image: z.string().min(1).optional(),
        memberIds: z.array(z.string().min(1)).min(1).max(49),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session.user.id;
      const { blocked } = await getViewerExclusions(db, me);

      const memberIds = [...new Set(input.memberIds)].filter(
        (id) => id !== me && !blocked.has(id),
      );

      if (memberIds.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Add at least one member',
        });
      }

      const [created] = await db
        .insert(conversation)
        .values({
          isGroup: true,
          name: input.name,
          image: input.image,
          createdById: me,
        })
        .returning({ id: conversation.id });

      const conversationId = created!.id;

      await db.insert(conversationParticipant).values([
        { conversationId, userId: me, role: 'owner' },
        ...memberIds.map((userId) => ({
          conversationId,
          userId,
          role: 'member' as const,
        })),
      ]);

      return { conversationId };
    }),

  rename: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        name: z.string().trim().min(1).max(100).optional(),
        image: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      await assertOwner(db, input.conversationId, ctx.session.user.id);

      const conv = await db.query.conversation.findFirst({
        where: eq(conversation.id, input.conversationId),
        columns: { isGroup: true },
      });
      if (!conv?.isGroup) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not a group conversation',
        });
      }

      await db
        .update(conversation)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.image !== undefined ? { image: input.image } : {}),
        })
        .where(eq(conversation.id, input.conversationId));

      return { ok: true };
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      await assertParticipant(db, input.conversationId, ctx.session.user.id);

      const conv = await db.query.conversation.findFirst({
        where: eq(conversation.id, input.conversationId),
        columns: { isGroup: true },
      });
      if (!conv?.isGroup) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not a group conversation',
        });
      }

      await db
        .insert(conversationParticipant)
        .values({
          conversationId: input.conversationId,
          userId: input.userId,
          role: 'member',
        })
        .onConflictDoNothing();

      return { ok: true };
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().min(1),
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      await assertOwner(db, input.conversationId, ctx.session.user.id);

      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Use leave to remove yourself',
        });
      }

      const conv = await db.query.conversation.findFirst({
        where: eq(conversation.id, input.conversationId),
        columns: { isGroup: true },
      });
      if (!conv?.isGroup) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not a group conversation',
        });
      }

      await db
        .delete(conversationParticipant)
        .where(
          and(
            eq(conversationParticipant.conversationId, input.conversationId),
            eq(conversationParticipant.userId, input.userId),
          ),
        );

      return { ok: true };
    }),

  leave: protectedProcedure
    .input(z.object({ conversationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      const userId = ctx.session.user.id;
      const participant = await assertParticipant(
        db,
        input.conversationId,
        userId,
      );

      const allParticipants = await db.query.conversationParticipant.findMany({
        where: eq(conversationParticipant.conversationId, input.conversationId),
        orderBy: (p, { asc }) => [asc(p.joinedAt)],
      });
      const remaining = allParticipants.filter((p) => p.userId !== userId);

      // Last participant leaving removes the conversation entirely — its
      // messages and participant rows cascade on delete.
      if (remaining.length === 0) {
        await db
          .delete(conversation)
          .where(eq(conversation.id, input.conversationId));
        return { ok: true };
      }

      const stillHasOwner = remaining.some((p) => p.role === 'owner');
      if (participant.role === 'owner' && !stillHasOwner) {
        // Auto-transfer ownership to the longest-standing remaining member.
        const successor = remaining[0]!;
        await db.batch([
          db
            .delete(conversationParticipant)
            .where(
              and(
                eq(
                  conversationParticipant.conversationId,
                  input.conversationId,
                ),
                eq(conversationParticipant.userId, userId),
              ),
            ),
          db
            .update(conversationParticipant)
            .set({ role: 'owner' })
            .where(
              and(
                eq(
                  conversationParticipant.conversationId,
                  input.conversationId,
                ),
                eq(conversationParticipant.userId, successor.userId),
              ),
            ),
        ]);
      } else {
        await db
          .delete(conversationParticipant)
          .where(
            and(
              eq(conversationParticipant.conversationId, input.conversationId),
              eq(conversationParticipant.userId, userId),
            ),
          );
      }

      return { ok: true };
    }),

  searchRecipients: protectedProcedure
    .input(z.object({ query: z.string().trim().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const me = ctx.session.user.id;
      const { blocked } = await getViewerExclusions(db, me);

      const term = `%${input.query}%`;
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          username: user.username,
          displayUsername: user.displayUsername,
          image: user.image,
        })
        .from(user)
        .where(
          and(
            ne(user.id, me),
            or(ilike(user.username, term), ilike(user.name, term)),
          ),
        )
        .limit(10);

      return rows.filter((row) => !blocked.has(row.id));
    }),
});
