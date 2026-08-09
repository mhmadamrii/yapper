import { relations } from 'drizzle-orm';
import { user } from './auth';
import { linkPreview } from './link-preview';

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
    // A quote post: a new post embedding another one. Unlike replyToPostId,
    // this is `set null` on delete — the quoting post's own text/media
    // stands on its own, it just loses the embed (renders as unavailable)
    // instead of being deleted with it.
    quotedPostId: text('quoted_post_id').references(
      (): AnyPgColumn => post.id,
      { onDelete: 'set null' },
    ),
    // The one link card this post renders, pointing into the shared unfurl
    // cache. Only the URL is stored here — title/image live in `link_preview`
    // so a re-unfurl updates every post that shares the link at once, and so
    // a client can never dictate what a card says.
    linkPreviewUrl: text('link_preview_url').references(() => linkPreview.url, {
      onDelete: 'set null',
    }),
    // Denormalized engagement counters — updated with atomic increments
    // alongside like/repost/reply writes, never recomputed via COUNT(*).
    // repostCount covers both a plain repost and a quote post, same as
    // X/Bluesky combine the two into one count.
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
    index('post_quotedPost_idx').on(table.quotedPostId),
  ],
);

export const postMedia = pgTable(
  'post_media',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    postId: text('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    // ImageKit identifiers: filePath drives render-time URL transformations
    // (no variant URLs stored), fileId is needed for deletion via their API.
    fileId: text('file_id').notNull(),
    filePath: text('file_path').notNull(),
    // Intrinsic dimensions let the client reserve layout space before the
    // image loads (no CLS).
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    format: text('format').notNull(),
    bytes: integer('bytes').notNull(),
    altText: text('alt_text'),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('post_media_post_position_idx').on(table.postId, table.position),
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
  quotedPost: one(post, {
    fields: [post.quotedPostId],
    references: [post.id],
    relationName: 'quotes',
  }),
  quotedBy: many(post, { relationName: 'quotes' }),
  media: many(postMedia),
  linkPreview: one(linkPreview, {
    fields: [post.linkPreviewUrl],
    references: [linkPreview.url],
  }),
}));

export const postMediaRelations = relations(postMedia, ({ one }) => ({
  post: one(post, {
    fields: [postMedia.postId],
    references: [post.id],
  }),
}));
