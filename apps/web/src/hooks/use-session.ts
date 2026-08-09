import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { authClient } from '@/lib/auth-client';
import { sessionQueryOptions } from '@/lib/session-query';

/**
 * Replacement for `authClient.useSession()`.
 *
 * better-auth's own hook fires its own request per mounting component, which
 * on a page like the timeline means a handful of duplicate session round
 * trips on top of the one the route guards already paid for. This reads the
 * single `sessionQueryOptions` entry instead — seeded on the server by the
 * root route loader and dehydrated into the client cache — so the session is
 * available on first paint with no request at all.
 */
export function useSession() {
  const { data, isPending, isFetching, refetch } =
    useQuery(sessionQueryOptions);

  return {
    data: data ?? null,
    isPending,
    isFetching,
    refetch,
  };
}

/**
 * Signs out, drops the cached session, and returns to the landing page.
 * Clearing the cache is what stops the route guards from waving the user
 * back into a guarded route until the entry would have gone stale.
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return async () => {
    await authClient.signOut();
    queryClient.setQueryData(sessionQueryOptions.queryKey, null);
    await navigate({ to: '/' });
  };
}

/**
 * Forces the cached session to be re-read — used after sign in / sign up,
 * where the cache still holds the logged-out result.
 */
export function useRefreshSession() {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
}
