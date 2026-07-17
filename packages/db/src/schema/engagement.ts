import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { post } from './post';

// Source-of-truth rows for engagement. Counts live denormalized on `post`
// (likeCount / repostCount) and are incremented atomically in the same
// transaction as inserts/deletes here.

export const like = pgTable(
  'like',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Composite PK doubles as the "has this user liked this post" lookup
    // and makes double-likes a constraint violation, not an app-level check.
    primaryKey({ columns: [table.userId, table.postId] }),
    index('like_postId_idx').on(table.postId),
  ],
);

export const repost = pgTable(
  'repost',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index('repost_postId_idx').on(table.postId),
    // Reposts surface in the reposter's profile feed, keyset-paged.
    index('repost_user_created_idx').on(table.userId, table.createdAt.desc()),
  ],
);

export const likeRelations = relations(like, ({ one }) => ({
  user: one(user, {
    fields: [like.userId],
    references: [user.id],
  }),
  post: one(post, {
    fields: [like.postId],
    references: [post.id],
  }),
}));

export const repostRelations = relations(repost, ({ one }) => ({
  user: one(user, {
    fields: [repost.userId],
    references: [user.id],
  }),
  post: one(post, {
    fields: [repost.postId],
    references: [post.id],
  }),
}));
