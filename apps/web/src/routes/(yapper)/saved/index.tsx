import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { ArrowLeft, Bookmark } from 'lucide-react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { authClient } from '@/lib/auth-client';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { useTRPC } from '@/utils/trpc';

export const Route = createFileRoute('/(yapper)/saved/')({
  beforeLoad: () => requireSession(),
  head: () => ({ meta: seo({ title: 'Saved' }) }),
  component: SavedPage,
});

function SavedPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const postsQuery = useInfiniteQuery(
    trpc.post.saved.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
        enabled: !!session,
      },
    ),
  );

  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center gap-4 border-b px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.history.back()}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-bold">Saved</h1>
          <Show when={session}>
            {(s) => (
              <p className="text-muted-foreground text-xs">
                @{s.user.username ?? 'unknown'}
              </p>
            )}
          </Show>
        </div>
      </header>

      <Switch
        fallback={
          <div className="px-8 py-16 text-center">
            <Bookmark className="text-muted-foreground mx-auto size-8" />
            <p className="mt-4 text-lg font-bold">Save posts for later</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Bookmark a post and it will show up here. Only you can see your
              saved posts.
            </p>
          </div>
        }
      >
        <Match when={sessionPending || (!!session && postsQuery.isPending)}>
          <FeedSkeleton />
        </Match>

        <Match when={!session}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Sign in to see your saved posts.
          </p>
        </Match>

        <Match when={postsQuery.error}>
          {(error) => (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              Could not load saved posts. {error.message}
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
