import { and, eq, isNull, sql } from 'drizzle-orm';
import { createDb } from '@yapper/db';
import {
  notification,
  notificationActor,
} from '@yapper/db/schema/notification';

type NotificationType = 'like' | 'repost' | 'reply' | 'follow';

// Aggregated notification write: one row per (recipient, type, post) — see
// notification_agg_key. actorCount only bumps when a *new* actor joins the
// aggregation, so re-triggering from the same actor (e.g. unlike -> like
// again) just resurfaces the row as unread without inflating the count.
// Best-effort: swallows its own errors so a notification bug never breaks
// the like/follow/reply mutation it's attached to.
export async function notify(
  db: ReturnType<typeof createDb>,
  args: {
    recipientId: string;
    actorId: string;
    type: NotificationType;
    postId?: string | null;
  },
) {
  if (args.recipientId === args.actorId) return;

  try {
    const postId = args.postId ?? null;
    const aggKey = and(
      eq(notification.recipientId, args.recipientId),
      eq(notification.type, args.type),
      postId ? eq(notification.postId, postId) : isNull(notification.postId),
    );

    const inserted = await db
      .insert(notification)
      .values({
        recipientId: args.recipientId,
        type: args.type,
        postId,
        actorCount: 1,
      })
      .onConflictDoNothing()
      .returning({ id: notification.id });

    if (inserted.length > 0) {
      await db
        .insert(notificationActor)
        .values({ notificationId: inserted[0]!.id, actorId: args.actorId })
        .onConflictDoNothing();
      return;
    }

    const existing = await db.query.notification.findFirst({
      where: aggKey,
      columns: { id: true },
    });
    if (!existing) return;

    const actorInserted = await db
      .insert(notificationActor)
      .values({ notificationId: existing.id, actorId: args.actorId })
      .onConflictDoNothing()
      .returning({ actorId: notificationActor.actorId });

    await db
      .update(notification)
      .set({
        updatedAt: sql`now()`,
        readAt: null,
        ...(actorInserted.length > 0
          ? { actorCount: sql`${notification.actorCount} + 1` }
          : {}),
      })
      .where(eq(notification.id, existing.id));
  } catch (err) {
    console.error('notify failed', err);
  }
}
