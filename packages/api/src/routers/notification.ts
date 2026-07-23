import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { createDb } from '@yapper/db';
import {
  notification,
  notificationActor,
} from '@yapper/db/schema/notification';
import { z } from 'zod';

import { protectedProcedure, router } from '../index';

export const notificationRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        // Keyset cursor: (updatedAt, id) of the last item of the previous
        // page — rows resurface on updatedAt so a re-triggered aggregation
        // jumps back to the top, same as the read/unread state expects.
        cursor: z.object({ updatedAt: z.string(), id: z.string() }).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = createDb();
      const recipientId = ctx.session.user.id;
      const cursor = input.cursor;

      const rows = await db.query.notification.findMany({
        where: and(
          eq(notification.recipientId, recipientId),
          cursor
            ? or(
                lt(notification.updatedAt, new Date(cursor.updatedAt)),
                and(
                  eq(notification.updatedAt, new Date(cursor.updatedAt)),
                  lt(notification.id, cursor.id),
                ),
              )
            : undefined,
        ),
        orderBy: (n, { desc }) => [desc(n.updatedAt), desc(n.id)],
        limit: input.limit + 1,
        with: {
          post: { columns: { id: true, content: true } },
        },
      });

      let nextCursor: { updatedAt: string; id: string } | null = null;
      if (rows.length > input.limit) {
        rows.pop();
        const last = rows[rows.length - 1]!;
        nextCursor = { updatedAt: last.updatedAt.toISOString(), id: last.id };
      }

      // Two-phase like the post feed's engagement lookups: page the
      // notification rows first, then hydrate a capped preview of actors
      // (avatar stack) per row in one IN-query rather than a per-row join.
      const notificationIds = rows.map((row) => row.id);
      const actorRows =
        notificationIds.length === 0
          ? []
          : await db.query.notificationActor.findMany({
              where: inArray(notificationActor.notificationId, notificationIds),
              orderBy: (a, { desc }) => [desc(a.createdAt)],
              with: {
                actor: {
                  columns: {
                    id: true,
                    name: true,
                    username: true,
                    displayUsername: true,
                    image: true,
                  },
                },
              },
            });

      const actorsByNotification = new Map<string, (typeof actorRows)[number]['actor'][]>(); // prettier-ignore
      for (const row of actorRows) {
        const list = actorsByNotification.get(row.notificationId) ?? [];
        if (list.length < 3) list.push(row.actor);
        actorsByNotification.set(row.notificationId, list);
      }

      const items = rows.map((row) => ({
        id: row.id,
        type: row.type,
        actorCount: row.actorCount,
        readAt: row.readAt,
        updatedAt: row.updatedAt,
        post: row.post,
        actors: actorsByNotification.get(row.id) ?? [],
      }));

      return { items, nextCursor };
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = createDb();
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notification)
      .where(
        and(
          eq(notification.recipientId, ctx.session.user.id),
          isNull(notification.readAt),
        ),
      );

    return { count: Number(row?.count ?? 0) };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = createDb();
      await db
        .update(notification)
        .set({ readAt: sql`now()` })
        .where(
          and(
            eq(notification.id, input.id),
            eq(notification.recipientId, ctx.session.user.id),
          ),
        );

      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = createDb();
    await db
      .update(notification)
      .set({ readAt: sql`now()` })
      .where(
        and(
          eq(notification.recipientId, ctx.session.user.id),
          isNull(notification.readAt),
        ),
      );

    return { ok: true };
  }),
});
