import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { seo } from '@/lib/seo';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { useTRPC } from '@/utils/trpc';

export const Route = createFileRoute('/(yapper)/search/$trending/')({
  pendingMinMs: 0,
  head: ({ params }) => ({ meta: seo({ title: `#${params.trending}` }) }),
  component: TrendingTagPage,
});

function TrendingTagPage() {
  const { trending } = Route.useParams();
  const router = useRouter();
  const trpc = useTRPC();

  // The server normalizes (lowercase, strips '#'); the title mirrors that so
  // `/search/Mariners` and `/search/mariners` read the same.
  const tag = trending.replace(/^#+/, '').toLowerCase();

  const postsQuery = useInfiniteQuery(
    trpc.trending.posts.infiniteQueryOptions(
      { hashtag: tag, limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
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
          <h1 className="truncate font-bold">#{tag}</h1>
          <p className="text-muted-foreground text-xs">Trending posts</p>
        </div>
      </header>

      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No posts with #{tag} yet.
          </p>
        }
      >
        <Match when={postsQuery.isPending}>
          <FeedSkeleton />
        </Match>

        <Match when={postsQuery.error}>
          {(error) => (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              Could not load posts. {error.message}
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
