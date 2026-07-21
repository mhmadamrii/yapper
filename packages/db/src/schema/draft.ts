import { relations } from 'drizzle-orm';
import { post } from './post';
import { user } from './auth';

import { pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core';

// Drafts are intentionally a separate table from `post`, not a `status`
// column on it: a draft has no engagement/social-graph surface (no
// likes/reposts/replies/counts, never in feeds, never visible to anyone
// but its author) — keeping it out of the `post` table means no post
// query anywhere has to remember to filter drafts out.
export const postDraft = pgTable(
  'post_draft',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // No min-length — a draft can be image-only, unlike a published post.
    content: text('content').notNull().default(''),
    replyToPostId: text('reply_to_post_id').references(() => post.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('post_draft_author_updated_idx').on(
      table.authorId,
      table.updatedAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const draftMedia = pgTable(
  'draft_media',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    draftId: text('draft_id')
      .notNull()
      .references(() => postDraft.id, { onDelete: 'cascade' }),
    fileId: text('file_id').notNull(),
    filePath: text('file_path').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    format: text('format').notNull(),
    bytes: integer('bytes').notNull(),
    altText: text('alt_text'),
    position: integer('position').default(0).notNull(),
  },
  (table) => [
    index('draft_media_draft_position_idx').on(table.draftId, table.position),
  ],
);

export const postDraftRelations = relations(postDraft, ({ one, many }) => ({
  author: one(user, {
    fields: [postDraft.authorId],
    references: [user.id],
  }),
  replyTo: one(post, {
    fields: [postDraft.replyToPostId],
    references: [post.id],
  }),
  media: many(draftMedia),
}));

export const draftMediaRelations = relations(draftMedia, ({ one }) => ({
  draft: one(postDraft, {
    fields: [draftMedia.draftId],
    references: [postDraft.id],
  }),
}));
