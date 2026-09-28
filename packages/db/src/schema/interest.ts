import { relations } from 'drizzle-orm';
import { user } from './auth';

import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

// Fixed, curated catalog (~24 rows) — seeded once at server startup, see
// `packages/db/src/seed/interests.ts`. `order` is the curated display order,
// not alphabetical.
export const interest = pgTable('interest', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  order: integer('order').notNull(),
});

export const userInterest = pgTable(
  'user_interest',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    interestSlug: text('interest_slug')
      .notNull()
      .references(() => interest.slug, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.interestSlug] }),
    index('user_interest_interest_idx').on(table.interestSlug),
  ],
);

export const interestRelations = relations(interest, ({ many }) => ({
  userInterests: many(userInterest),
}));

export const userInterestRelations = relations(userInterest, ({ one }) => ({
  user: one(user, {
    fields: [userInterest.userId],
    references: [user.id],
  }),
  interest: one(interest, {
    fields: [userInterest.interestSlug],
    references: [interest.slug],
  }),
}));
