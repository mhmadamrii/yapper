import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Lock, PenSquare } from 'lucide-react';
import { useState } from 'react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { useTRPC } from '@/utils/trpc';
import { DialogCreatePost } from '@/routes/(yapper)/-components/dialog-create-post';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'members', label: 'Members' },
] as const;

type Tab = (typeof TABS)[number]['key'];

// Static decoys — no real data is ever sent for a locked community, so the
// blur is purely cosmetic.
function LockedPlaceholder({ label }: { label: string }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none blur-sm select-none"
        inert
      >
        <For each={[0, 1, 2]}>
          {(i) => (
            <div
              key={i}
              className="border-border flex gap-3 border-b px-4 py-4"
            >
              <div className="bg-muted size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-3 w-1/3 rounded" />
                <div className="bg-muted h-3 w-full rounded" />
                <div className="bg-muted h-3 w-2/3 rounded" />
              </div>
            </div>
          )}
        </For>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="bg-background/80 flex flex-col items-center gap-2 rounded-xl px-6 py-5 backdrop-blur">
          <Lock className="size-6" />
          <p className="font-bold">This community is private</p>
          <p className="text-muted-foreground text-sm">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function CommunityContent({
  communityId,
  visibility,
  role,
}: {
  communityId: string;
  visibility: 'public' | 'private';
  role: 'owner' | 'moderator' | 'member' | null;
}) {
  const [tab, setTab] = useState<Tab>('posts');

  return (
    <>
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

      <Show
        when={tab === 'posts'}
        fallback={
          <MembersTab communityId={communityId} visibility={visibility} />
        }
      >
        <PostsTab
          communityId={communityId}
          visibility={visibility}
          isMember={!!role}
        />
      </Show>
    </>
  );
}

function PostsTab({
  communityId,
  visibility,
  isMember,
}: {
  communityId: string;
  visibility: 'public' | 'private';
  isMember: boolean;
}) {
  const trpc = useTRPC();
  const postsQuery = useInfiniteQuery(
    trpc.post.byCommunity.infiniteQueryOptions(
      { communityId },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  const locked = postsQuery.data?.pages[0]?.locked ?? false;
  const posts = postsQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Show when={isMember}>
        <div className="border-border flex justify-end border-b px-4 py-3">
          <DialogCreatePost
            communityId={communityId}
            trigger={
              <Button size="sm" className="rounded-full">
                <PenSquare className="size-4" />
                Post
              </Button>
            }
          />
        </div>
      </Show>

      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No posts yet.
          </p>
        }
      >
        <Match when={postsQuery.isPending}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Loading...
          </p>
        </Match>
        <Match when={locked && visibility === 'private'}>
          <LockedPlaceholder label="Join to see posts." />
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

function MembersTab({
  communityId,
  visibility,
}: {
  communityId: string;
  visibility: 'public' | 'private';
}) {
  const trpc = useTRPC();
  const membersQuery = useInfiniteQuery(
    trpc.community.members.infiniteQueryOptions(
      { id: communityId },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  const locked = membersQuery.data?.pages[0]?.locked ?? false;
  const members = membersQuery.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Switch
      fallback={
        <p className="text-muted-foreground px-4 py-12 text-center text-sm">
          No members yet.
        </p>
      }
    >
      <Match when={membersQuery.isPending}>
        <p className="text-muted-foreground px-4 py-12 text-center text-sm">
          Loading...
        </p>
      </Match>
      <Match when={locked && visibility === 'private'}>
        <LockedPlaceholder label="Join to see members." />
      </Match>
      <Match when={members.length > 0}>
        <For each={members}>
          {(m) => (
            <Link
              key={m.id}
              to="/profile/$userId"
              params={{ userId: m.id }}
              className="hover:bg-accent/30 border-border flex items-center gap-3 border-b px-4 py-3 transition-colors"
            >
              <UserAvatar
                name={m.name}
                image={m.image}
                className="size-10 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-bold">
                  {m.name}
                  <Show when={m.verified}>
                    <VerifiedBadge />
                  </Show>
                </p>
                <p className="text-muted-foreground truncate text-sm">
                  @{m.username ?? 'unknown'}
                </p>
              </div>
              <Show when={m.role !== 'member'}>
                <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium capitalize">
                  {m.role}
                </span>
              </Show>
            </Link>
          )}
        </For>
        <Show when={membersQuery.hasNextPage}>
          <div className="flex justify-center p-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={membersQuery.isFetchingNextPage}
              onClick={() => membersQuery.fetchNextPage()}
            >
              {membersQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        </Show>
      </Match>
    </Switch>
  );
}
