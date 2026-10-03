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

export const communityVisibilities = ['public', 'private'] as const;
export type CommunityVisibility = (typeof communityVisibilities)[number];

export const communityRoles = ['owner', 'moderator', 'member'] as const;
export type CommunityRole = (typeof communityRoles)[number];

export const community = pgTable(
  'community',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description').notNull(),
    // Object key in the media bucket (see `media.uploadUrl`).
    coverKey: text('cover_key'),
    visibility: text('visibility')
      .$type<CommunityVisibility>()
      .default('public')
      .notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Denormalized, atomically incremented on join/leave — never COUNT(*)
    // per render.
    memberCount: integer('member_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Keyset pagination for the discover list: (member_count, id) desc.
    index('community_discover_idx').on(table.memberCount, table.id),
    index('community_owner_idx').on(table.ownerId),
  ],
);

export const communityMember = pgTable(
  'community_member',
  {
    communityId: text('community_id')
      .notNull()
      .references(() => community.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').$type<CommunityRole>().default('member').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.communityId, table.userId] }),
    index('community_member_user_idx').on(table.userId, table.joinedAt),
  ],
);

export const communityRelations = relations(community, ({ one, many }) => ({
  owner: one(user, { fields: [community.ownerId], references: [user.id] }),
  members: many(communityMember),
}));

export const communityMemberRelations = relations(
  communityMember,
  ({ one }) => ({
    community: one(community, {
      fields: [communityMember.communityId],
      references: [community.id],
    }),
    user: one(user, {
      fields: [communityMember.userId],
      references: [user.id],
    }),
  }),
);
