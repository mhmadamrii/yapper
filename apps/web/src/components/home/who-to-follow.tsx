import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { X } from 'lucide-react';
import { For, Show } from '@/components/control-flow';
import { ProfileHoverCard } from '@/components/profile-hover-card';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { useDismissedSuggestions } from '@/lib/dismissed-suggestions';
import { INTERSTITIAL_SIZE } from '@/lib/feed-interstitials';
import { useSetFollow } from '@/lib/use-set-follow';
import { useTRPC } from '@/utils/trpc';

type Recommendation =
  inferRouterOutputs<AppRouter>['recommendation']['follows'][number];

// One fetch backs every interstitial in the feed; each module reads a
// different window of it via `slot`, so the same faces don't repeat.
const RECOMMENDATION_LIMIT = 24;

/**
 * "People you might know" — the feed interstitial. `slot` is the module's
 * ordinal down the timeline (0, 1, 2, …) and selects which window of the
 * recommendation list this module shows.
 *
 * Renders nothing at all when there is no signal to show: logged out, still
 * loading, errored, or the window is empty after dismissals. An interstitial
 * that renders an empty shell is worse than one that stays out of the way.
 */
export function WhoToFollow({ slot = 0 }: { slot?: number }) {
  const trpc = useTRPC();
  const { isDismissed } = useDismissedSuggestions();

  const { data } = useQuery(
    trpc.recommendation.follows.queryOptions(
      { limit: RECOMMENDATION_LIMIT },
      {
        // Suggestions are expensive (2-hop graph walk) and not time-sensitive,
        // so every module on the page shares one cached result.
        staleTime: 5 * 60 * 1000,
      },
    ),
  );

  const available = (data ?? []).filter((rec) => !isDismissed(rec.user.id));
  const start = slot * INTERSTITIAL_SIZE;
  const window = available.slice(start, start + INTERSTITIAL_SIZE);

  if (window.length === 0) return null;

  return (
    <section className="border-border bg-accent/20 border-b px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-bold">People you might know</h2>
        <Show when={available.length > start + INTERSTITIAL_SIZE}>
          <Link
            to="/"
            className="text-primary text-sm hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            See more
          </Link>
        </Show>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <For each={window}>
          {(rec) => <SuggestionCard key={rec.user.id} recommendation={rec} />}
        </For>
      </div>
    </section>
  );
}

function SuggestionCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const { user, followedByMe, mutualCount, reason } = recommendation;
  const { dismiss } = useDismissedSuggestions();
  const setFollow = useSetFollow();

  const handleDismiss = () => {
    dismiss(user.id);
  };

  const handleFollow = () => {
    setFollow(user.id, !followedByMe);
  };

  // `mutualCount` is only meaningful for graph-derived suggestions; the
  // popularity fallback reports 0 and gets a generic line instead.
  const subtitle =
    reason === 'fof' && mutualCount > 0
      ? `${mutualCount} ${mutualCount === 1 ? 'person you follow follows' : 'people you follow follow'} them`
      : (user.bio ?? 'Popular on Yapper');

  return (
    <article className="border-border bg-background relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center">
      <button
        onClick={handleDismiss}
        aria-label={`Dismiss ${user.name}`}
        className="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1.5 right-1.5 rounded-full p-1 transition-colors"
      >
        <X className="size-3.5" />
      </button>

      <ProfileHoverCard userId={user.id}>
        <Link
          to="/profile/$userId"
          params={{ userId: user.id }}
          className="flex w-full flex-col items-center gap-2"
        >
          <UserAvatar name={user.name} image={user.image} className="size-14" />
          <span className="flex w-full min-w-0 items-center justify-center gap-1 font-semibold hover:underline">
            <span className="min-w-0 truncate">{user.name}</span>
            <Show when={user.emailVerified}>
              <VerifiedBadge className="size-3.5 shrink-0" />
            </Show>
          </span>
        </Link>
      </ProfileHoverCard>

      <p className="text-muted-foreground line-clamp-2 text-xs">{subtitle}</p>

      <Button
        variant={followedByMe ? 'secondary' : 'default'}
        className="mt-auto w-full rounded-full"
        size="sm"
        onClick={handleFollow}
      >
        {followedByMe ? 'Following' : 'Follow'}
      </Button>
    </article>
  );
}
