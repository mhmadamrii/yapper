import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Skeleton } from '@yapper/ui/components/skeleton';
import { ArrowLeft } from 'lucide-react';

import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { formatCount } from '@/lib/utils';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { useTRPC } from '@/utils/trpc';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'replies', label: 'Replies' },
  { key: 'likes', label: 'Likes' },
  { key: 'saved', label: 'Saved' },
] as const;

type ProfileTab = (typeof TABS)[number]['key'];

export const Route = createFileRoute('/(yapper)/profile/$userId/')({
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const router = useRouter();
  const trpc = useTRPC();

  const [tab, setTab] = useState<ProfileTab>('posts');

  const userQuery = useQuery(trpc.user.byId.queryOptions({ id: userId }));

  const postsQuery = useInfiniteQuery(
    trpc.post.byUser.infiniteQueryOptions(
      { userId, tab, limit: 20 },
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
          <h1 className="truncate font-bold">
            {userQuery.data?.name ?? 'Profile'}
          </h1>
          <Show when={userQuery.data}>
            {(user) => (
              <p className="text-muted-foreground text-xs">
                {formatCount(user.postCount)} posts
              </p>
            )}
          </Show>
        </div>
      </header>

      <Switch>
        <Match when={userQuery.isPending}>
          <ProfileHeaderSkeleton />
        </Match>

        <Match when={userQuery.error}>
          {(error) => (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              {error.message}
            </p>
          )}
        </Match>

        <Match when={userQuery.data}>
          {(user) => (
            <>
              <div className="from-primary/40 to-primary/10 h-36 bg-gradient-to-r" />

              <div className="px-4">
                <div className="-mt-10 mb-3 flex items-end justify-between">
                  <img
                    src={user.image ?? '/prabowo.jpg'}
                    alt={user.name}
                    className="border-background size-20 rounded-full border-4 object-cover"
                  />
                  <Button variant="secondary" className="rounded-full px-5">
                    Follow
                  </Button>
                </div>

                <h2 className="text-2xl font-bold">{user.name}</h2>
                <p className="text-muted-foreground">
                  @{user.username ?? 'unknown'}
                </p>

                <div className="mt-2 mb-4 flex gap-4 text-sm">
                  <span>
                    <span className="font-bold">
                      {formatCount(user.followerCount)}
                    </span>{' '}
                    <span className="text-muted-foreground">followers</span>
                  </span>
                  <span>
                    <span className="font-bold">
                      {formatCount(user.followingCount)}
                    </span>{' '}
                    <span className="text-muted-foreground">following</span>
                  </span>
                  <span>
                    <span className="font-bold">
                      {formatCount(user.postCount)}
                    </span>{' '}
                    <span className="text-muted-foreground">posts</span>
                  </span>
                </div>
              </div>
            </>
          )}
        </Match>
      </Switch>

      <nav className="border-border flex border-b">
        <For each={TABS}>
          {(t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="hover:bg-accent/50 flex-1 py-3 text-sm font-semibold transition-colors"
            >
              <span
                className={
                  tab === t.key
                    ? 'border-primary border-b-2 pb-3'
                    : 'text-muted-foreground'
                }
              >
                {t.label}
              </span>
            </button>
          )}
        </For>
      </nav>

      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Nothing here yet.
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

function ProfileHeaderSkeleton() {
  return (
    <div>
      <Skeleton className="h-36 rounded-none" />
      <div className="space-y-3 px-4 pt-4 pb-4">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}
