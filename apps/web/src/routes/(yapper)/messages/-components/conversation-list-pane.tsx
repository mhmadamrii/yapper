import { useInfiniteQuery } from '@tanstack/react-query';
import { cn } from '@yapper/ui/lib/utils';
import { Link, useParams } from '@tanstack/react-router';
import { Inbox, PencilLine, Settings } from 'lucide-react';
import { Button } from '@yapper/ui/components/button';
import { Empty, EmptyMedia, EmptyTitle } from '@yapper/ui/components/empty';
import { Skeleton } from '@yapper/ui/components/skeleton';
import { For, Show, Switch, Match } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { authClient } from '@/lib/auth-client';
import { timeAgo } from '@/lib/utils';
import { useTRPC } from '@/utils/trpc';
import { DialogNewChat } from './dialog-new-chat';

import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

type ConversationItem = inferRouterOutputs<AppRouter>['message']['list']['items'][number]; // prettier-ignore

export function ConversationListPane() {
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();
  const { conversationId: activeId } = useParams({ strict: false });

  const listQuery = useInfiniteQuery(
    trpc.message.list.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
        enabled: !!session,
      },
    ),
  );

  const conversations = listQuery.data?.pages.flatMap((page) => page.items) ?? []; // prettier-ignore

  return (
    <aside className="flex w-[350px] shrink-0 flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold">Chats</h1>
        <div className="flex items-center gap-1">
          <Link
            to="/messages/requests"
            className="bg-secondary text-secondary-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
          >
            <Inbox className="size-4" />
            Requests
          </Link>
          <Button variant="ghost" size="icon-sm">
            <Settings className="size-4" />
          </Button>
          <DialogNewChat
            trigger={
              <Button size="icon-sm" className="rounded-full">
                <PencilLine className="size-4" />
              </Button>
            }
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Switch>
          <Match when={listQuery.isPending}>
            <div className="flex flex-col gap-4 px-4 py-2">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-12 shrink-0 rounded-full" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          </Match>

          <Match when={conversations.length === 0}>
            <Empty className="h-full border-none">
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Inbox empty</EmptyTitle>
            </Empty>
          </Match>

          <Match when={conversations.length > 0}>
            <For each={conversations}>
              {(conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeId}
                />
              )}
            </For>

            <Show when={listQuery.hasNextPage}>
              <div className="flex justify-center py-4">
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={listQuery.isFetchingNextPage}
                  onClick={() => listQuery.fetchNextPage()}
                >
                  {listQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                </Button>
              </div>
            </Show>
          </Match>
        </Switch>
      </div>
    </aside>
  );
}

function ConversationRow({
  conversation,
  active,
}: {
  conversation: ConversationItem;
  active: boolean;
}) {
  const peer = conversation.peers[0];
  const name =
    conversation.name ??
    (conversation.isGroup
      ? conversation.peers.map((p) => p.name).join(', ')
      : peer?.name) ??
    'Unknown';
  const image = conversation.image ?? peer?.image;

  return (
    <Link
      to="/messages/$conversationId"
      params={{ conversationId: conversation.id }}
      className={cn(
        'hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors',
        {
          'bg-accent': active,
        },
      )}
    >
      <UserAvatar name={name} image={image} className="size-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-bold">{name}</p>
          <span className="text-muted-foreground shrink-0 text-xs">
            {timeAgo(conversation.lastMessageAt)}
          </span>
        </div>
        <p className="text-muted-foreground truncate text-sm">
          {conversation.lastMessagePreview ?? 'No messages yet'}
        </p>
      </div>
      <Show when={conversation.hasUnread}>
        <span className="bg-primary size-2.5 shrink-0 rounded-full" />
      </Show>
    </Link>
  );
}
