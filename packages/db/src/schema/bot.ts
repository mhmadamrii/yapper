import { relations } from 'drizzle-orm';
import { user } from './auth';
import { community } from './community';

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// One-to-one with `user`, same PK-as-FK idiom as `userProfile` — a bot's
// `user` row is the account itself (posts, avatar, name all live there);
// this table is just its scheduling/generation config. `ownerId` is a
// second FK to the same `user` table (the human who created it), so both
// relations need `relationName` to disambiguate.
export const botConfig = pgTable(
  'bot_config',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    systemPrompt: text('system_prompt').notNull(),
    postIntervalMinutes: integer('post_interval_minutes').notNull(),
    active: boolean('active').default(true).notNull(),
    // Community the bot posts into (null = its own profile/global feed).
    // Set via `moderation.assignBotCommunity`, which also makes the bot a
    // member so the community's membership/visibility rules stay consistent.
    communityId: text('community_id').references(() => community.id, {
      onDelete: 'set null',
    }),
    lastPostedAt: timestamp('last_posted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('bot_config_owner_idx').on(table.ownerId)],
);

export const botConfigRelations = relations(botConfig, ({ one }) => ({
  bot: one(user, {
    fields: [botConfig.userId],
    references: [user.id],
    relationName: 'botAccount',
  }),
  owner: one(user, {
    fields: [botConfig.ownerId],
    references: [user.id],
    relationName: 'botOwner',
  }),
}));
