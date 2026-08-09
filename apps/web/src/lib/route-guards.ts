import type { RouterAppContext } from '@/routes/__root';
import { redirect } from '@tanstack/react-router';
import { sessionQueryOptions } from './session-query';

/**
 * Guard for `beforeLoad`. Never blocks a navigation on the network once the
 * session has been read once (the root route seeds the cache during SSR).
 *
 * When the cache is already populated the decision is made synchronously and
 * revalidation happens in the background; only a genuinely cold cache awaits
 * the fetch. This is a UX guard, not a security boundary — the real check
 * lives in `protectedProcedure` on the API — so serving a navigation from a
 * slightly stale session is fine.
 */
export async function requireSession(context: RouterAppContext) {
  const { queryClient } = context;
  const cached = queryClient.getQueryData(sessionQueryOptions.queryKey);

  if (cached !== undefined) {
    // Fire-and-forget: only actually refetches if the entry is stale.
    void queryClient.ensureQueryData(sessionQueryOptions);
    if (!cached) {
      throw redirect({ to: '/' });
    }
    return cached;
  }

  const session = await queryClient.ensureQueryData(sessionQueryOptions);

  if (!session) {
    throw redirect({ to: '/' });
  }

  return session;
}
