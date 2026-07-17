import { relations } from 'drizzle-orm';
import { user } from './auth';

import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const post = pgTable(
  'post',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    replyToPostId: text('reply_to_post_id').references(
      (): AnyPgColumn => post.id,
      { onDelete: 'cascade' },
    ),
    // Denormalized engagement counters — updated with atomic increments
    // alongside like/repost/reply writes, never recomputed via COUNT(*).
    likeCount: integer('like_count').default(0).notNull(),
    repostCount: integer('repost_count').default(0).notNull(),
    replyCount: integer('reply_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    // Keyset pagination: cursor is (createdAt, id), always paged DESC.
    index('post_created_idx').on(table.createdAt.desc(), table.id.desc()),
    index('post_author_created_idx').on(
      table.authorId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index('post_replyTo_idx').on(table.replyToPostId),
  ],
);

export const postRelations = relations(post, ({ one, many }) => ({
  author: one(user, {
    fields: [post.authorId],
    references: [user.id],
  }),
  replyTo: one(post, {
    fields: [post.replyToPostId],
    references: [post.id],
    relationName: 'replies',
  }),
  replies: many(post, { relationName: 'replies' }),
}));
