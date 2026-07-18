import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { Bird, Hash, ImageIcon } from 'lucide-react';
import { PostCard } from './post-card';
import { authClient } from '@/lib/auth-client';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { DialogCreatePost } from '@/routes/(yapper)/-components/dialog-create-post';
import { useTRPC } from '@/utils/trpc';

export function Feed() {
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();

  const tabs = session ? ['Discover', 'Following'] : ['Discover', 'Feeds ✨'];
  const [activeTab, setActiveTab] = useState(0);

  const postsQuery = useInfiniteQuery(
    trpc.post.list.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
      },
    ),
  );

  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        <Show when={session}>
          <div className="relative flex items-center justify-center py-3">
            <Bird className="text-primary size-7" />
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
                  className={
                    activeTab === i
                      ? 'border-primary border-b-2 pb-3'
                      : 'text-muted-foreground'
                  }
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
                <img
                  src={s.user.image ?? '/prabowo.jpg'}
                  alt={s.user.name}
                  className="size-10 rounded-full object-cover"
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
            Nothing here yet. Be the first to yap.
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
