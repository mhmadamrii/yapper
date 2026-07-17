import { relations } from 'drizzle-orm';
import { user } from './auth';

import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const follow = pgTable(
  'follow',
  {
    followerId: text('follower_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    followeeId: text('followee_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // PK covers "who does X follow" (feed fan-out-on-read source);
    // the reverse index covers "who follows X" (followers list).
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    index('follow_followee_idx').on(table.followeeId),
  ],
);

// Blocks are bidirectional in effect: neither side sees the other in
// feeds/replies. Enforced in queries, not just hidden client-side.
export const block = pgTable(
  'block',
  {
    blockerId: text('blocker_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    blockedId: text('blocked_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    index('block_blocked_idx').on(table.blockedId),
  ],
);

// Mutes are one-directional and invisible to the muted user.
export const mute = pgTable(
  'mute',
  {
    muterId: text('muter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    mutedId: text('muted_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.muterId, table.mutedId] })],
);

// Denormalized per-user counters, kept in a side table so the better-auth
// managed `user` table stays untouched. Row is created lazily on first write.
export const userStats = pgTable('user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
  postCount: integer('post_count').default(0).notNull(),
});

export const followRelations = relations(follow, ({ one }) => ({
  follower: one(user, {
    fields: [follow.followerId],
    references: [user.id],
    relationName: 'following',
  }),
  followee: one(user, {
    fields: [follow.followeeId],
    references: [user.id],
    relationName: 'followers',
  }),
}));

export const blockRelations = relations(block, ({ one }) => ({
  blocker: one(user, {
    fields: [block.blockerId],
    references: [user.id],
    relationName: 'blocksIssued',
  }),
  blocked: one(user, {
    fields: [block.blockedId],
    references: [user.id],
    relationName: 'blocksReceived',
  }),
}));

export const muteRelations = relations(mute, ({ one }) => ({
  muter: one(user, {
    fields: [mute.muterId],
    references: [user.id],
    relationName: 'mutesIssued',
  }),
  muted: one(user, {
    fields: [mute.mutedId],
    references: [user.id],
    relationName: 'mutesReceived',
  }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(user, {
    fields: [userStats.userId],
    references: [user.id],
  }),
}));
