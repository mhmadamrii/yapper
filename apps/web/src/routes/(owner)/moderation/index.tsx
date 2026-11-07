import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Input } from '@yapper/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@yapper/ui/components/select';
import { Spinner } from '@yapper/ui/components/spinner';
import { Switch as SwitchToggle } from '@yapper/ui/components/switch';
import { ArrowLeft, Bot, Lock } from 'lucide-react';
import { useState } from 'react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { UserAvatar } from '@/components/user-avatar';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { toast } from '@/lib/toast';
import { useTRPC } from '@/utils/trpc';

export const Route = createFileRoute('/(owner)/moderation/')({
  pendingMinMs: 0,
  // UX guard only — every moderation procedure re-checks the owner email.
  beforeLoad: async ({ context }) => {
    await requireSession(context);
    const isOwner = await context.queryClient.ensureQueryData(
      context.trpc.moderation.isOwner.queryOptions(),
    );
    if (!isOwner) {
      throw redirect({ to: '/' });
    }
  },
  head: () => ({ meta: seo({ title: 'Moderation' }) }),
  component: RouteComponent,
});

type Tab = 'users' | 'communities';

const TABS: { key: Tab; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'communities', label: 'Communities' },
];

function RouteComponent() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('users');

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
        <h1 className="font-bold">Moderation</h1>
      </header>

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

      <Switch>
        <Match when={tab === 'users'}>
          <UsersPanel />
        </Match>
        <Match when={tab === 'communities'}>
          <CommunitiesPanel />
        </Match>
      </Switch>
    </main>
  );
}

function UsersPanel() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const input = { query: search.trim() || undefined };
  const usersQuery = useInfiniteQuery(
    trpc.moderation.users.infiniteQueryOptions(input, {
      getNextPageParam: (last) => last.nextCursor,
    }),
  );
  const users = usersQuery.data?.pages.flatMap((page) => page.items) ?? [];

  // Optimistic: flip the switch immediately, roll back on error.
  const queryKey = trpc.moderation.users.infiniteQueryKey(input);
  const setVerified = useMutation(
    trpc.moderation.setVerified.mutationOptions({
      onMutate: async ({ userId, verified }) => {
        await queryClient.cancelQueries({ queryKey });
        const previous = queryClient.getQueryData(queryKey);
        queryClient.setQueryData(queryKey, (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((page) => ({
                  ...page,
                  items: page.items.map((u) =>
                    u.id === userId ? { ...u, verified } : u,
                  ),
                })),
              }
            : old,
        );
        return { previous };
      },
      onError: (error, _vars, ctx) => {
        queryClient.setQueryData(queryKey, ctx?.previous);
        toast.error(error.message);
      },
    }),
  );

  return (
    <>
      <div className="border-border border-b p-4">
        <Input
          placeholder="Search name, username or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No users found.
          </p>
        }
      >
        <Match when={usersQuery.isPending}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Loading...
          </p>
        </Match>
        <Match when={users.length > 0}>
          <For each={users}>
            {(u) => (
              <div
                key={u.id}
                className="border-border flex items-center gap-3 border-b p-4"
              >
                <UserAvatar
                  name={u.name}
                  image={u.image}
                  className="size-11 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-bold">
                    {u.name}
                    {u.isBot ? (
                      <Bot className="text-muted-foreground size-4" />
                    ) : null}
                  </p>
                  <p className="text-muted-foreground truncate text-sm">
                    @{u.username ?? 'unknown'} · {u.email}
                  </p>
                </div>
                <SwitchToggle
                  checked={u.verified}
                  aria-label={`Verify ${u.name}`}
                  onCheckedChange={(verified) =>
                    setVerified.mutate({ userId: u.id, verified })
                  }
                />
              </div>
            )}
          </For>
        </Match>
      </Switch>

      {usersQuery.hasNextPage ? (
        <div className="flex justify-center p-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={usersQuery.isFetchingNextPage}
            onClick={() => usersQuery.fetchNextPage()}
          >
            {usersQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </>
  );
}

// Owner-only view of any community's posts — private ones included, no
// membership needed (the server's `communityPosts` skips the access check).
function CommunitiesPanel() {
  const trpc = useTRPC();
  const [communityId, setCommunityId] = useState<string | null>(null);

  const communitiesQuery = useQuery(trpc.moderation.communities.queryOptions());
  const communities = communitiesQuery.data ?? [];

  const postsQuery = useInfiniteQuery(
    trpc.moderation.communityPosts.infiniteQueryOptions(
      { communityId: communityId ?? '' },
      {
        enabled: communityId != null,
        getNextPageParam: (last) => last.nextCursor,
      },
    ),
  );
  const posts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <div className="border-border border-b p-4">
        <Select
          value={communityId}
          onValueChange={(value) => setCommunityId(value)}
          items={communities.map((c) => ({ value: c.id, label: c.name }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a community" />
          </SelectTrigger>
          <SelectContent>
            <For each={communities}>
              {(c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  <Show when={c.visibility === 'private'}>
                    <Lock className="text-muted-foreground size-3.5" />
                  </Show>
                  <span className="text-muted-foreground text-xs">
                    {c.memberCount} members
                  </span>
                </SelectItem>
              )}
            </For>
          </SelectContent>
        </Select>
      </div>

      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No posts in this community.
          </p>
        }
      >
        <Match when={communityId == null}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Pick a community to see its posts.
          </p>
        </Match>
        <Match when={postsQuery.isPending}>
          <div className="text-muted-foreground flex justify-center px-4 py-12">
            <Spinner className="size-6" />
          </div>
        </Match>
        <Match when={posts.length > 0}>
          <For each={posts}>
            {(post) => <PostCard key={post.id} post={post} />}
          </For>
          <Show when={postsQuery.hasNextPage}>
            <div className="flex justify-center p-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={postsQuery.isFetchingNextPage}
                onClick={() => postsQuery.fetchNextPage()}
              >
                {postsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          </Show>
        </Match>
      </Switch>
    </>
  );
}
