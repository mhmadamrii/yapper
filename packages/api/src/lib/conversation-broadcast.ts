import { env } from '@yapper/env/server';

// `packages/api` deliberately has no dependency on @cloudflare/workers-types
// (it's Workers-agnostic), so the DO binding's generic RPC stub type can't
// fully resolve here — cast through this minimal shape rather than let TS
// try to instantiate it.
interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): {
    fetch(input: string, init?: RequestInit): Promise<Response>;
  };
}

// Fire-and-forget push to the conversation's Durable Object so already-open
// SSE readers get the new message immediately. Best-effort: a DO hiccup must
// never fail the `send` mutation that already committed to Postgres.
export async function broadcastMessage(
  conversationId: string,
  payload: unknown,
) {
  try {
    const namespace =
      env.CONVERSATION_DO as unknown as DurableObjectNamespaceLike;
    const id = namespace.idFromName(conversationId);
    const stub = namespace.get(id);
    await stub.fetch('https://conversation-room.internal/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('broadcastMessage failed', err);
  }
}
