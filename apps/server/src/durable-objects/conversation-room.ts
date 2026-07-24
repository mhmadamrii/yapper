import { DurableObject } from 'cloudflare:workers';

// One instance per conversation (via idFromName(conversationId)). Purely a
// fan-out relay for SSE readers — the message write itself always goes
// through the tRPC `send` mutation; this DO just pushes the already-committed
// payload to whichever clients currently have the thread open.
export class ConversationRoom extends DurableObject {
  private writers = new Set<WritableStreamDefaultWriter<Uint8Array>>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const payload = await request.text();
      await this.broadcast(`data: ${payload}\n\n`);
      return new Response('ok');
    }

    const { readable, writable } = new TransformStream<
      Uint8Array,
      Uint8Array
    >();
    const writer = writable.getWriter();
    this.writers.add(writer);

    // Keep the connection alive through idle proxies/timeouts — EventSource
    // ignores comment lines (`:` prefix), so this is invisible to the client
    // but prevents a silent drop that would otherwise show up as a gap.
    const keepalive = setInterval(() => {
      writer.write(new TextEncoder().encode(': ping\n\n')).catch(() => {
        clearInterval(keepalive);
        this.writers.delete(writer);
      });
    }, 25_000);

    request.signal.addEventListener('abort', () => {
      clearInterval(keepalive);
      this.writers.delete(writer);
      writer.close().catch(() => {});
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  private async broadcast(frame: string) {
    const bytes = new TextEncoder().encode(frame);
    for (const writer of this.writers) {
      try {
        await writer.write(bytes);
      } catch {
        this.writers.delete(writer);
      }
    }
  }
}
