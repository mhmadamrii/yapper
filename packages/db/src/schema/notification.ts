import { relations } from 'drizzle-orm';
import { user } from './auth';
import { post } from './post';

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  index,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const notificationType = pgEnum('notification_type', [
  'like',
  'repost',
  'reply',
  'follow',
]);

// Aggregated notifications: one row per (recipient, type, post), bumped in
// place as more actors arrive — renders as "X and 3 others liked your post".
// Actors live in notification_actor; actorCount is the denormalized total.
export const notification = pgTable(
  'notification',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    // Target post; null for follow notifications.
    postId: text('post_id').references(() => post.id, { onDelete: 'cascade' }),
    actorCount: integer('actor_count').default(1).notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // Bumped on each new actor so the row resurfaces at the top of the list.
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Aggregation key — upsert target. nullsNotDistinct so follow
    // notifications (postId null) also collapse into one row.
    unique('notification_agg_key')
      .on(table.recipientId, table.type, table.postId)
      .nullsNotDistinct(),
    index('notification_recipient_updated_idx').on(
      table.recipientId,
      table.updatedAt.desc(),
    ),
  ],
);

export const notificationActor = pgTable(
  'notification_actor',
  {
    notificationId: text('notification_id')
      .notNull()
      .references(() => notification.id, { onDelete: 'cascade' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.notificationId, table.actorId] })],
);

export const notificationRelations = relations(
  notification,
  ({ one, many }) => ({
    recipient: one(user, {
      fields: [notification.recipientId],
      references: [user.id],
    }),
    post: one(post, {
      fields: [notification.postId],
      references: [post.id],
    }),
    actors: many(notificationActor),
  }),
);

export const notificationActorRelations = relations(
  notificationActor,
  ({ one }) => ({
    notification: one(notification, {
      fields: [notificationActor.notificationId],
      references: [notification.id],
    }),
    actor: one(user, {
      fields: [notificationActor.actorId],
      references: [user.id],
    }),
  }),
);
