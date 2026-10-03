import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@yapper/ui/components/input';
import { Flame, LayoutGrid, Search, TrendingUp, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { UserAvatar } from '@/components/user-avatar';
import { useSession } from '@/hooks/use-session';
import { useTRPC } from '@/utils/trpc';
import { seo } from '@/lib/seo';
import { timeAgo } from '@/lib/utils';
import { CommunityRow } from '@/routes/(yapper)/-components/community-card';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';

export const Route = createFileRoute('/(yapper)/search/')({
  head: () => ({ meta: seo({ title: 'Explore' }) }),
  component: ExplorePage,
});

function ExplorePage() {
  const { data: session } = useSession();
  const trpc = useTRPC();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const peopleQuery = useQuery(
    trpc.user.search.queryOptions(
      { query: debounced },
      { enabled: !!session && debounced.length > 0 },
    ),
  );
  const postsQuery = useQuery(
    trpc.post.search.queryOptions(
      { query: debounced, limit: 10 },
      { enabled: debounced.length > 0 },
    ),
  );

  return (
    <main className="border-border w-full max-w-[640px] border-x">
      <div className="p-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search"
            className="rounded-full pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Show when={query.length > 0}>
            <button
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          </Show>
        </div>
      </div>

      <Show when={debounced.length > 0} fallback={<ExploreDefault />}>
        <div className="divide-border divide-y">
          <Show when={session}>
            <div className="p-4">
              <h2 className="mb-3 font-bold">People</h2>
              <Switch
                fallback={
                  <p className="text-muted-foreground text-sm">
                    No people found.
                  </p>
                }
              >
                <Match when={peopleQuery.isPending}>
                  <p className="text-muted-foreground text-sm">Searching...</p>
                </Match>
                <Match when={(peopleQuery.data?.length ?? 0) > 0}>
                  <div className="flex flex-col gap-1">
                    <For each={peopleQuery.data ?? []}>
                      {(person) => (
                        <Link
                          key={person.id}
                          to="/profile/$userId"
                          params={{ userId: person.id }}
                          className="hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors"
                        >
                          <UserAvatar
                            name={person.name}
                            image={person.image}
                            className="size-10 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-bold">{person.name}</p>
                            <p className="text-muted-foreground truncate text-sm">
                              @{person.username ?? 'unknown'}
                            </p>
                          </div>
                        </Link>
                      )}
                    </For>
                  </div>
                </Match>
              </Switch>
            </div>
          </Show>

          <div>
            <h2 className="p-4 pb-0 font-bold">Posts</h2>
            <Switch
              fallback={
                <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                  No posts found.
                </p>
              }
            >
              <Match when={postsQuery.isPending}>
                <FeedSkeleton />
              </Match>
              <Match when={(postsQuery.data?.items.length ?? 0) > 0}>
                <For each={postsQuery.data?.items ?? []}>
                  {(post) => <PostCard key={post.id} post={post} />}
                </For>
              </Match>
            </Switch>
          </div>
        </div>
      </Show>
    </main>
  );
}

function ExploreDefault() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const interestListQuery = useQuery(trpc.interest.list.queryOptions());
  const myInterestsQuery = useQuery(
    trpc.interest.mine.queryOptions(undefined, { enabled: !!session }),
  );
  const myInterestNames = (myInterestsQuery.data ?? [])
    .map((slug) => interestListQuery.data?.find((i) => i.slug === slug)?.name)
    .filter((name): name is string => !!name);

  const topPostsQuery = useQuery(
    trpc.interest.topPosts.queryOptions({ limit: 5 }, { enabled: !!session }),
  );
  const topPosts = topPostsQuery.data ?? [];

  const [showInterests, setShowInterests] = useState(true);

  return (
    <>
      <Show when={showInterests && session && myInterestNames.length > 0}>
        <div className="border-border border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <LayoutGrid className="text-primary size-5" />
              Your interests
            </div>
            <button
              aria-label="Dismiss"
              onClick={() => setShowInterests(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <For each={myInterestNames}>
              {(name) => (
                <span
                  key={name}
                  className="bg-accent rounded-full px-4 py-2 text-sm font-medium"
                >
                  {name}
                </span>
              )}
            </For>
          </div>

          <p className="text-muted-foreground mt-3 text-sm">
            Your interests help us find what you like!
          </p>

          <Link
            to="/search/interest"
            className="bg-primary text-primary-foreground mt-4 block w-full rounded-full py-2.5 text-center font-semibold"
          >
            Edit interests
          </Link>
        </div>
      </Show>

      <CommunitiesSection />

      <Show when={session}>
        <div className="border-border border-b p-4">
          <div className="mb-3 flex items-center gap-2 font-bold">
            <TrendingUp className="text-primary size-5" />
            Trending in your interests
          </div>

          <Switch
            fallback={
              <p className="text-muted-foreground text-sm">
                {myInterestNames.length === 0 ? (
                  <>
                    Pick some interests to see top posts here.{' '}
                    <Link
                      to="/search/interest"
                      className="text-primary hover:underline"
                    >
                      Pick interests
                    </Link>
                  </>
                ) : (
                  'No posts in your interests yet.'
                )}
              </p>
            }
          >
            <Match when={topPosts.length > 0}>
              <div className="-mx-4">
                <For each={topPosts}>
                  {(post, index) => (
                    <Link
                      to="/post/$postId"
                      params={{ postId: post.id }}
                      className="hover:bg-accent/30 flex items-center justify-between gap-4 px-4 py-3 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-muted-foreground w-5 shrink-0 text-lg font-bold">
                          {index + 1}.
                        </span>
                        <UserAvatar
                          name={post.author.name}
                          image={post.author.image}
                          className="size-9 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold">{post.content}</p>
                          <span className="text-muted-foreground text-sm">
                            {interestListQuery.data?.find(
                              (i) => i.slug === post.interestSlug,
                            )?.name ?? 'General'}
                          </span>
                        </div>
                      </div>

                      <Show
                        when={index === 0}
                        fallback={
                          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-medium">
                            {timeAgo(post.createdAt)} ago
                          </span>
                        }
                      >
                        <span className="bg-destructive/10 text-destructive flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium">
                          <Flame className="size-4" />
                          Hot
                        </span>
                      </Show>
                    </Link>
                  )}
                </For>
              </div>
            </Match>
          </Switch>
        </div>
      </Show>
    </>
  );
}

function CommunitiesSection() {
  const trpc = useTRPC();
  const listQuery = useQuery(trpc.community.list.queryOptions({}));
  const items = listQuery.data?.items ?? [];

  // Joined communities first, then the biggest ones to discover.
  const shown = [
    ...items.filter((c) => c.joined),
    ...items.filter((c) => !c.joined),
  ].slice(0, 3);

  return (
    <div className="border-border border-b pt-4">
      <div className="mb-1 flex items-center gap-2 px-4 font-bold">
        <Users className="text-primary size-5" />
        Communities
      </div>

      <Show
        when={shown.length > 0}
        fallback={
          <p className="text-muted-foreground px-4 pt-2 text-sm">
            Find people who share your interests, or start your own.
          </p>
        }
      >
        <For each={shown}>
          {(c) => <CommunityRow key={c.id} community={c} joined={c.joined} />}
        </For>
      </Show>

      <div className="p-4">
        <Link
          to="/communities"
          className="bg-primary text-primary-foreground block w-full rounded-full py-2.5 text-center font-semibold"
        >
          Explore communities
        </Link>
      </div>
    </div>
  );
}
