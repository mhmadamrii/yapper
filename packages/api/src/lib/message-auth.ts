import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { createDb } from '@yapper/db';
import { conversationParticipant } from '@yapper/db/schema/message';

export async function assertParticipant(
  db: ReturnType<typeof createDb>,
  conversationId: string,
  userId: string,
) {
  const participant = await db.query.conversationParticipant.findFirst({
    where: and(
      eq(conversationParticipant.conversationId, conversationId),
      eq(conversationParticipant.userId, userId),
    ),
  });

  if (!participant) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Not a participant of this conversation',
    });
  }

  return participant;
}

export async function assertOwner(
  db: ReturnType<typeof createDb>,
  conversationId: string,
  userId: string,
) {
  const participant = await assertParticipant(db, conversationId, userId);

  if (participant.role !== 'owner') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only the group owner can do this',
    });
  }

  return participant;
}
