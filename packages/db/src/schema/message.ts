import { relations } from 'drizzle-orm';
import { user } from './auth';

import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  index,
  unique,
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const conversationRole = pgEnum('conversation_role', [
  'owner',
  'member',
]);

// One row per conversation, 1:1 or group. Preview fields are denormalized
// from the latest message so the inbox list never joins into `message` per
// render (same ethos as post.likeCount / userStats).
export const conversation = pgTable(
  'conversation',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    isGroup: boolean('is_group').default(false).notNull(),
    // Null for 1:1 (display name/image derived from the other participant);
    // required (enforced in the router) for groups.
    name: text('name'),
    image: text('image'),
    createdById: text('created_by_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Dedupe key for 1:1s only: `[sorted(userA,userB)].join(':')`. Null for
    // groups — Postgres treats multiple NULLs as distinct, so many group
    // conversations coexist with a null dmKey while any two users can have
    // at most one 1:1 thread; the insert itself is the get-or-create.
    dmKey: text('dm_key'),
    lastMessageId: text('last_message_id').references(
      (): AnyPgColumn => message.id,
      { onDelete: 'set null' },
    ),
    lastMessagePreview: text('last_message_preview'),
    lastMessageSenderId: text('last_message_sender_id').references(
      () => user.id,
      { onDelete: 'set null' },
    ),
    lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    unique('conversation_dm_key_unique').on(table.dmKey),
    // Keyset pagination for the inbox: cursor is (lastMessageAt, id).
    index('conversation_last_message_idx').on(
      table.lastMessageAt.desc(),
      table.id.desc(),
    ),
  ],
);

// Composite-PK join table — mirrors follow/block/mute: the PK covers "who's
// in conversation X" (participant list, add/remove checks), the secondary
// index covers "which conversations is user Y in" (inbox query).
export const conversationParticipant = pgTable(
  'conversation_participant',
  {
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: conversationRole('role').default('member').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    // Last-read pointer, not a per-message read-receipt table: unread is
    // derived as `lastReadAt < conversation.lastMessageAt` at query time, no
    // fan-out write to recipients on every send.
    lastReadMessageId: text('last_read_message_id').references(
      (): AnyPgColumn => message.id,
      { onDelete: 'set null' },
    ),
    lastReadAt: timestamp('last_read_at'),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index('conversation_participant_user_idx').on(table.userId),
  ],
);

export const message = pgTable(
  'message',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Keyset pagination scoped per conversation.
    index('message_conversation_created_idx').on(
      table.conversationId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const conversationRelations = relations(
  conversation,
  ({ one, many }) => ({
    createdBy: one(user, {
      fields: [conversation.createdById],
      references: [user.id],
    }),
    lastMessage: one(message, {
      fields: [conversation.lastMessageId],
      references: [message.id],
    }),
    lastMessageSender: one(user, {
      fields: [conversation.lastMessageSenderId],
      references: [user.id],
    }),
    participants: many(conversationParticipant),
    messages: many(message),
  }),
);

export const conversationParticipantRelations = relations(
  conversationParticipant,
  ({ one }) => ({
    conversation: one(conversation, {
      fields: [conversationParticipant.conversationId],
      references: [conversation.id],
    }),
    user: one(user, {
      fields: [conversationParticipant.userId],
      references: [user.id],
    }),
  }),
);

export const messageRelations = relations(message, ({ one }) => ({
  conversation: one(conversation, {
    fields: [message.conversationId],
    references: [conversation.id],
  }),
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
  }),
}));
