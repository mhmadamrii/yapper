import { createFileRoute } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';
import { seo } from '@/lib/seo';
import { useConversationStream } from '@/lib/use-conversation-stream';
import { useDocumentTitle } from '@/lib/use-document-title';
import { UserAvatar } from '@/components/user-avatar';
import { useTRPC } from '@/utils/trpc';

import { Match, Show, Switch } from '@/components/control-flow';
import { ConversationThread } from '../-components/conversation-thread';
import { GroupSettingsDropdown } from '../-components/group-settings-dropdown';
import { MessageComposer } from '../-components/message-composer';

export const Route = createFileRoute('/(yapper)/messages/$conversationId/')({
  head: () => ({ meta: seo({ title: 'Messages' }) }),
  component: ConversationPage,
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();
  useConversationStream(conversationId);

  // Cheap way to get this conversation's display header: pull it out of the
  // already-fetched inbox list cache rather than adding a new `byId` query.
  const listQuery = useInfiniteQuery(
    trpc.message.list.infiniteQueryOptions(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
      },
    ),
  );
  const conversationMeta = listQuery.data?.pages
    .flatMap((page) => page.items)
    .find((item) => item.id === conversationId);

  const isGroup = conversationMeta?.isGroup ?? false;
  const peer = conversationMeta?.peers[0];
  const title =
    conversationMeta?.name ??
    (isGroup
      ? conversationMeta?.peers.map((p) => p.name).join(', ')
      : peer?.name);
  useDocumentTitle(title);

  return (
    <div className="flex h-svh flex-col">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Switch>
            <Match when={isGroup}>
              <UserAvatar
                name={title ?? 'Group'}
                image={conversationMeta?.image}
                className="size-9"
              />
              <div className="min-w-0">
                <p className="truncate font-bold">{title ?? 'Group chat'}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {(conversationMeta?.peers.length ?? 0) + 1} members
                </p>
              </div>
            </Match>
            <Match when={peer}>
              {(p) => (
                <>
                  <UserAvatar
                    name={p.name}
                    image={p.image}
                    className="size-9"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      @{p.username ?? 'unknown'}
                    </p>
                  </div>
                </>
              )}
            </Match>
            <Match when={!peer && !isGroup}>
              <p className="font-bold">{title ?? 'Conversation'}</p>
            </Match>
          </Switch>
        </div>

        <Show when={isGroup}>
          <GroupSettingsDropdown
            conversationId={conversationId}
            isOwner={conversationMeta?.myRole === 'owner'}
            members={conversationMeta?.peers ?? []}
          />
        </Show>
      </header>

      <ConversationThread
        conversationId={conversationId}
        currentUserId={session?.user.id}
      />
      <MessageComposer conversationId={conversationId} />
    </div>
  );
}
