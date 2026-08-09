import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { post } from './post';

/**
 * Unfurl cache, keyed by the normalized URL rather than by post.
 *
 * The same link gets posted by many people — fetching a third party's HTML
 * once per post (let alone once per render) is both slow and rude. One row
 * per URL means the hundredth person to share a link pays nothing, and the
 * card keeps rendering after the origin site goes down.
 *
 * Failed unfurls are cached too (`status: 'failed'`), otherwise every paste
 * of a dead link re-attempts a 5-second timeout.
 */
export const linkPreview = pgTable(
  'link_preview',
  {
    // Normalized form (see `normalizeUrl` in the API package) so that
    // trivially different spellings of the same link share a row.
    url: text('url').primaryKey(),
    status: text('status', { enum: ['ok', 'failed'] }).notNull(),
    title: text('title'),
    description: text('description'),
    // Absolute URL of the og:image, resolved against the page at fetch time.
    imageUrl: text('image_url'),
    siteName: text('site_name'),
    // Host shown in the card's footer, kept as its own column so the client
    // never has to re-parse the URL.
    domain: text('domain').notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  },
  (table) => [index('link_preview_fetchedAt_idx').on(table.fetchedAt)],
);

export const linkPreviewRelations = relations(linkPreview, ({ many }) => ({
  posts: many(post),
}));
