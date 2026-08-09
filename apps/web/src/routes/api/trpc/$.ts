import { createFileRoute } from '@tanstack/react-router';
import { proxyToServer } from '@/lib/proxy-to-server';

/**
 * Same-origin entry point for tRPC.
 *
 * The session cookie is deliberately scoped to this app's origin (see
 * `lib/auth-client.ts` and the `/api/auth/$` proxy), which means a request
 * the browser sends straight to the Workers domain carries no cookie at all
 * and every `protectedProcedure` answers "Authentication required". Relaying
 * through this route keeps the call same-origin, so the cookie is attached.
 *
 * The path is rewritten because the Worker mounts tRPC at `/trpc/*`, not
 * `/api/trpc/*` — taken from `request.url` rather than the splat param so
 * percent-encoding in the batched procedure list survives the round trip.
 */
export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      ANY: ({ request }) =>
        proxyToServer(
          request,
          new URL(request.url).pathname.replace(/^\/api/, ''),
        ),
    },
  },
});
