import { useState } from 'react';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { MentionText } from '@/components/mention-text';
import { UserAvatar } from '@/components/user-avatar';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { authClient } from '@/lib/auth-client';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { timeAgo } from '@/lib/utils';
import { useTRPC } from '@/utils/trpc';

import {
  Heart,
  MessageCircle,
  Repeat2,
  Settings,
  UserPlus,
} from 'lucide-react';

import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

type NotificationItem = inferRouterOutputs<AppRouter>['notification']['list']['items'][number]; // prettier-ignore

const TABS = ['All', 'Mentions'] as const;
const TYPE_META = {
  like: {
    icon: <Heart className="size-6 fill-rose-500 text-rose-500" />,
    action: 'liked your post',
  },
  repost: {
    icon: <Repeat2 className="size-6 text-green-500" />,
    action: 'reposted your post',
  },
  reply: {
    icon: <MessageCircle className="text-primary size-6" />,
    action: 'replied to your post',
  },
  follow: {
    icon: <UserPlus className="text-primary size-6" />,
    action: 'followed you',
  },
} as const;

export const Route = createFileRoute('/(yapper)/notifications/')({
  pendingMinMs: 0,
  beforeLoad: ({ context }) => requireSession(context),
  head: () => ({ meta: seo({ title: 'Notifications' }) }),
  component: NotificationsPage,
  pendingComponent: () => (
    <section className="border-border min-h-svh w-full max-w-[640px] border-x">
      <FeedSkeleton />
    </section>
  ),
});

function NotificationsPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(0);
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const notificationsQuery = useInfiniteQuery(
    trpc.notification.list.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
        enabled: !!session,
      },
    ),
  );

  const markRead = useMutation(trpc.notification.markRead.mutationOptions());
  const markAllRead = useMutation(
    trpc.notification.markAllRead.mutationOptions({
      onSuccess: () => notificationsQuery.refetch(),
    }),
  );

  const notifications = notificationsQuery.data?.pages.flatMap((page) => page.items) ?? []; // prettier-ignore
  const hasUnread = notifications.some((n) => !n.readAt);

  function handleRowClick(notification: NotificationItem) {
    if (!notification.readAt) markRead.mutate({ id: notification.id });

    if (notification.post) {
      navigate({
        to: '/post/$postId',
        params: { postId: notification.post.id },
      });
    } else if (notification.actors[0]) {
      navigate({
        to: '/profile/$userId',
        params: { userId: notification.actors[0].id },
      });
    }
  }

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Notifications</h1>
          <div className="flex items-center gap-1">
            <Show when={hasUnread}>
              <Button
                variant="ghost"
                size="sm"
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                Mark all read
              </Button>
            </Show>
            <Button variant="ghost" size="icon-sm">
              <Settings className="size-5" />
            </Button>
          </div>
        </div>

        <nav className="flex">
          <For each={TABS}>
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

      <Switch>
        <Match
          when={sessionPending || (!!session && notificationsQuery.isPending)}
        >
          <FeedSkeleton />
        </Match>

        <Match when={!session}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Sign in to see your notifications.
          </p>
        </Match>

        <Match when={notificationsQuery.error}>
          {(error) => (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              Could not load notifications. {error.message}
            </p>
          )}
        </Match>

        {/* No mention parsing exists yet — the Mentions tab is a stub. */}
        <Match when={activeTab === 1}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Mentions are coming soon.
          </p>
        </Match>

        <Match when={activeTab === 0}>
          <For
            each={notifications}
            fallback={
              <p className="text-muted-foreground px-4 py-12 text-center text-sm">
                Nothing here yet.
              </p>
            }
          >
            {(notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onClick={() => handleRowClick(notification)}
              />
            )}
          </For>

          <Show when={notificationsQuery.hasNextPage}>
            <div className="flex justify-center py-6">
              <Button
                variant="secondary"
                className="rounded-full"
                disabled={notificationsQuery.isFetchingNextPage}
                onClick={() => notificationsQuery.fetchNextPage()}
              >
                {notificationsQuery.isFetchingNextPage
                  ? 'Loading...'
                  : 'Load more'}
              </Button>
            </div>
          </Show>
        </Match>
      </Switch>
    </main>
  );
}

function NotificationRow({
  notification,
  onClick,
}: {
  notification: NotificationItem;
  onClick: () => void;
}) {
  const { icon, action } = TYPE_META[notification.type];
  const [first] = notification.actors;
  const othersCount = notification.actorCount - 1;

  return (
    <div
      onClick={onClick}
      className={`border-border hover:bg-accent/30 cursor-pointer border-b px-4 py-3 transition-colors ${
        notification.readAt ? '' : 'bg-primary/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex w-9 shrink-0 justify-center">{icon}</div>
        <div className="flex items-center gap-1.5">
          <For each={notification.actors}>
            {(actor) => (
              <UserAvatar
                key={actor.id}
                name={actor.name}
                image={actor.image}
                className="size-8"
              />
            )}
          </For>
        </div>
      </div>

      <p className="pl-12 mt-2 text-[15px]">
        <span className="font-bold">{first?.name ?? 'Someone'}</span>
        <Show when={othersCount > 0}>
          {' '}
          and <span className="font-bold">{othersCount} others</span>
        </Show>{' '}
        {action}{' '}
        <span className="text-muted-foreground">
          · {timeAgo(notification.updatedAt)}
        </span>
      </p>
      <Show when={notification.post}>
        {(post) => (
          <p className="text-muted-foreground pl-12 truncate">
            <MentionText text={post.content} />
          </p>
        )}
      </Show>
    </div>
  );
}
