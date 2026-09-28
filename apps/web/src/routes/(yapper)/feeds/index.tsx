import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Hash } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@yapper/ui/lib/utils';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { useTRPC } from '@/utils/trpc';

export const Route = createFileRoute('/(yapper)/feeds/')({
  pendingMinMs: 0,
  beforeLoad: ({ context }) => requireSession(context),
  head: () => ({ meta: seo({ title: 'Feeds' }) }),
  component: FeedsPage,
});

function FeedsPage() {
  const trpc = useTRPC();
  const myInterestsQuery = useQuery(trpc.interest.mine.queryOptions());
  const interestListQuery = useQuery(trpc.interest.list.queryOptions());

  // null = "All" (every saved interest combined). A chip narrows to just
  // that one slug.
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const mySlugs = myInterestsQuery.data ?? [];
  const interestSlugs = activeSlug ? [activeSlug] : mySlugs;
  const myInterests = mySlugs
    .map((slug) => interestListQuery.data?.find((i) => i.slug === slug))
    .filter((i): i is NonNullable<typeof i> => !!i);

  const postsQuery = useInfiniteQuery(
    trpc.interest.posts.infiniteQueryOptions(
      { interestSlugs, limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
        enabled: interestSlugs.length > 0,
      },
    ),
  );

  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        <div className="px-4 py-3">
          <h1 className="font-bold">Feeds</h1>
        </div>

        <Show when={mySlugs.length > 0}>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
            <button
              onClick={() => setActiveSlug(null)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                activeSlug === null
                  ? 'bg-foreground text-background'
                  : 'bg-accent text-foreground hover:bg-accent/70',
              )}
            >
              All
            </button>
            <For each={myInterests}>
              {(option) => (
                <button
                  key={option.slug}
                  onClick={() => setActiveSlug(option.slug)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                    activeSlug === option.slug
                      ? 'bg-foreground text-background'
                      : 'bg-accent text-foreground hover:bg-accent/70',
                  )}
                >
                  {option.name}
                </button>
              )}
            </For>
          </nav>
        </Show>
      </header>

      <Switch
        fallback={
          <div className="px-8 py-16 text-center">
            <Hash className="text-muted-foreground mx-auto size-8" />
            <p className="mt-4 text-lg font-bold">Build your Feeds tab</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Pick a few interests and posts tagged with them will show up here.
            </p>
            <Link
              to="/search/interest"
              className="bg-primary text-primary-foreground mt-4 inline-block rounded-full px-6 py-2.5 font-semibold"
            >
              Pick interests
            </Link>
          </div>
        }
      >
        <Match when={myInterestsQuery.isPending}>
          <FeedSkeleton />
        </Match>

        <Match when={mySlugs.length > 0 && postsQuery.isPending}>
          <FeedSkeleton />
        </Match>

        <Match when={mySlugs.length > 0 && postsQuery.error}>
          {(error) => (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              Could not load this feed. {error.message}
            </p>
          )}
        </Match>

        <Match when={mySlugs.length > 0 && posts.length === 0}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No posts tagged with this topic yet.
          </p>
        </Match>

        <Match when={mySlugs.length > 0 && posts.length > 0}>
          <For each={posts}>
            {(post) => <PostCard key={post.id} post={post} />}
          </For>

          <Show when={postsQuery.hasNextPage}>
            <div className="flex justify-center py-6">
              <Button
                variant="secondary"
                className="rounded-full"
                disabled={postsQuery.isFetchingNextPage}
                onClick={() => postsQuery.fetchNextPage()}
              >
                {postsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          </Show>
        </Match>
      </Switch>
    </main>
  );
}
