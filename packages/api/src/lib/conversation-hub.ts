// In-process SSE fan-out, one Set<Writer> per conversation. Replaces the
// Cloudflare Durable Object that used to do this — a single container is
// already one process, so the DO's location-transparent RPC hop isn't
// needed. If the server ever runs more than one replica, this needs to
// become Redis pub/sub instead.
const rooms = new Map<string, Set<WritableStreamDefaultWriter<Uint8Array>>>();

export function subscribeToConversation(
  conversationId: string,
  signal: AbortSignal,
): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  let room = rooms.get(conversationId);
  if (!room) {
    room = new Set();
    rooms.set(conversationId, room);
  }
  room.add(writer);

  const cleanup = () => {
    clearInterval(keepalive);
    room?.delete(writer);
    if (room && room.size === 0) {
      rooms.delete(conversationId);
    }
    writer.close().catch(() => {});
  };

  // Keep the connection alive through idle proxies/timeouts — EventSource
  // ignores comment lines (`:` prefix), so this is invisible to the client
  // but prevents a silent drop that would otherwise show up as a gap.
  const keepalive = setInterval(() => {
    writer.write(new TextEncoder().encode(': ping\n\n')).catch(cleanup);
  }, 25_000);

  signal.addEventListener('abort', cleanup);

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function broadcastToConversation(
  conversationId: string,
  payload: unknown,
) {
  const room = rooms.get(conversationId);
  if (!room) return;

  const bytes = new TextEncoder().encode(
    `data: ${JSON.stringify(payload)}\n\n`,
  );
  for (const writer of room) {
    try {
      await writer.write(bytes);
    } catch {
      room.delete(writer);
    }
  }
}
