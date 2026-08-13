import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { post } from './post';

/**
 * One row per (hashtag, post) — the raw event log the trending job reads.
 *
 * `authorId` is denormalized off `post` on purpose: the cron aggregates
 * `count(distinct author_id)` over 24h of rows, and joining `post` for that
 * would turn a single index scan into a join over the largest table in the
 * schema on every tick.
 *
 * Deduping happens on the write path (a Set per post), so a row here means
 * "this author used this tag in this post", counted at most once.
 */
export const hashtagMention = pgTable(
  'hashtag_mention',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Always lowercased with no leading '#'. Display casing is a frontend
    // choice — storing one canonical form is what makes #Mariners and
    // #mariners the same trend.
    hashtag: text('hashtag').notNull(),
    postId: text('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Drives both the cron's 24h window scan and the 7-day retention delete.
    index('hashtag_mention_created_idx').on(table.createdAt),
    // Per-tag history: "show me posts for #tag, newest first".
    index('hashtag_mention_tag_created_idx').on(
      table.hashtag,
      table.createdAt.desc(),
    ),
  ],
);

/**
 * Precomputed top-N snapshot, rewritten wholesale by the cron every 5 min.
 *
 * Stays ~10 rows forever, which is the entire point: the read path is a
 * `limit 5` over a tiny table ordered by an already-computed rank, and never
 * touches `hashtag_mention`. Ranking cost is paid on a schedule, not per
 * request.
 */
export const trendingTopic = pgTable('trending_topic', {
  hashtag: text('hashtag').primaryKey(),
  rank: integer('rank').notNull(),
  // Velocity ratio, kept for debugging/tuning the formula. Clients rank by
  // `rank`, not by this.
  score: doublePrecision('score').notNull(),
  // Distinct authors in the last hour — the "12.4K posts"-style subtitle,
  // already counted so the read path doesn't have to.
  recentAuthors: integer('recent_authors').notNull(),
  computedAt: timestamp('computed_at').defaultNow().notNull(),
});

export const hashtagMentionRelations = relations(hashtagMention, ({ one }) => ({
  post: one(post, {
    fields: [hashtagMention.postId],
    references: [post.id],
  }),
  author: one(user, {
    fields: [hashtagMention.authorId],
    references: [user.id],
  }),
}));
