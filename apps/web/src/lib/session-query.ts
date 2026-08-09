import { queryOptions } from '@tanstack/react-query';
import { getUser } from '@/functions/get-user';

/**
 * Single source of truth for the current session on the web side.
 *
 * The route guards used to await `getUser()` inline in `beforeLoad`, which
 * meant every navigation to a guarded route paid a full round trip
 * (browser -> web server fn -> auth Worker) before the router would even
 * start rendering. Parking the session in the query cache makes that cost
 * once-per-page-load instead of once-per-navigation: the root route seeds
 * it during SSR, it is dehydrated to the client, and subsequent guards
 * resolve from memory.
 *
 * `staleTime` matches better-auth's `session.cookieCache.maxAge` (60s), so a
 * background revalidation is never more stale than the server's own cached
 * view of the session.
 */
export const sessionQueryOptions = queryOptions({
  queryKey: ['session'] as const,
  queryFn: () => getUser(),
  staleTime: 60 * 1000,
  gcTime: Infinity,
});
