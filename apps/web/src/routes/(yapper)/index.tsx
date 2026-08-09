import { Fragment, useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { Hash, ImageIcon } from 'lucide-react';
import { PostCard } from '@/components/home/post-card';
import { WhoToFollow } from '@/components/home/who-to-follow';
import { UserAvatar } from '@/components/user-avatar';
import {
  interstitialSlotNumber,
  isInterstitialSlot,
} from '@/lib/feed-interstitials';
import { useSession } from '@/hooks/use-session';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { DialogCreatePost } from '@/routes/(yapper)/-components/dialog-create-post';
import { useTRPC } from '@/utils/trpc';
import { seo } from '@/lib/seo';
import { cn } from '@yapper/ui/lib/utils';

export const Route = createFileRoute('/(yapper)/')({
  head: () => ({ meta: seo({ title: 'Discover' }) }),
  component: HomeComponent,
});

function HomeComponent() {
  const trpc = useTRPC();

  const { data: session } = useSession();
  const { ref: loadMoreRef, inView } = useInView();

  const tabs = session ? ['Discover', 'Following'] : ['Discover', 'Feeds ✨'];

  const [activeTab, setActiveTab] = useState(0);
  const showFollowing = !!session && activeTab === 1;

  const discoverQuery = useInfiniteQuery(
    trpc.post.list.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
        enabled: !showFollowing,
      },
    ),
  );

  const followingQuery = useInfiniteQuery(
    trpc.post.listFollowing.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
        enabled: showFollowing,
      },
    ),
  );

  const postsQuery = showFollowing ? followingQuery : discoverQuery;
  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  useEffect(() => {
    if (inView && postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
      postsQuery.fetchNextPage();
    }
  }, [inView, postsQuery.hasNextPage, postsQuery.isFetchingNextPage]);

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        <Show when={session}>
          <div className="relative flex items-center justify-center py-3">
            <img src="/yapper-logo.png" alt="Yapper" className="size-7" />
            <Hash className="text-muted-foreground absolute right-4 size-5" />
          </div>
        </Show>
        <nav className="flex">
          <For each={tabs}>
            {(tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className="hover:bg-accent/50 flex-1 py-3 text-sm font-semibold transition-colors"
              >
                <span
                  className={cn('text-muted-foreground', {
                    'border-primary border-b-2 pb-3': activeTab === i,
                  })}
                >
                  {tab}
                </span>
              </button>
            )}
          </For>
        </nav>
      </header>
      <Show when={session}>
        {(s) => (
          <DialogCreatePost
            trigger={
              <button className="border-border hover:bg-accent/30 flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors">
                <UserAvatar
                  name={s.user.name}
                  image={s.user.image}
                  className="size-10"
                />
                <span className="text-muted-foreground flex-1 text-lg">
                  What's up?
                </span>
                <ImageIcon className="text-muted-foreground size-5" />
              </button>
            }
          />
        )}
      </Show>
      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            {showFollowing
              ? 'No posts yet. Follow people to see their yaps here.'
              : 'Nothing here yet. Be the first to yap.'}
          </p>
        }
      >
        <Match when={postsQuery.isPending}>
          <FeedSkeleton />
        </Match>
        <Match when={postsQuery.error}>
          {(error) => (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              Could not load the feed. {error.message}
            </p>
          )}
        </Match>
        <Match when={posts.length > 0}>
          <For each={posts}>
            {(post, i) => (
              <Fragment key={post.id}>
                <PostCard post={post} />
                {/* Suggestions are personalised, so there is nothing to show
                    a logged-out visitor. */}
                <Show when={!!session && isInterstitialSlot(i)}>
                  <WhoToFollow slot={interstitialSlotNumber(i)} />
                </Show>
              </Fragment>
            )}
          </For>
          <Show when={postsQuery.hasNextPage}>
            <div ref={loadMoreRef} className="min-h-10">
              <Show when={postsQuery.isFetchingNextPage}>
                <FeedSkeleton count={4} />
              </Show>
            </div>
          </Show>
        </Match>
      </Switch>
    </main>
  );
}
