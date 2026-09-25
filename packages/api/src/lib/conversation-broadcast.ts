import { broadcastToConversation } from './conversation-hub';

// Fire-and-forget push to the conversation's SSE hub so already-open readers
// get the new message immediately. Best-effort: a broadcast hiccup must
// never fail the `send` mutation that already committed to Postgres.
export async function broadcastMessage(
  conversationId: string,
  payload: unknown,
) {
  try {
    await broadcastToConversation(conversationId, payload);
  } catch (err) {
    console.error('broadcastMessage failed', err);
  }
}
