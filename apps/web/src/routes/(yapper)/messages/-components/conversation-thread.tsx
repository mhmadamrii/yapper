import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@yapper/ui/components/message-scroller';

import { For, Show } from '@/components/control-flow';
import { useTRPC } from '@/utils/trpc';
import { MessageBubble } from './message-bubble';

export function ConversationThread({
  conversationId,
  currentUserId,
}: {
  conversationId: string;
  currentUserId: string | undefined;
}) {
  const trpc = useTRPC();

  const threadQuery = useInfiniteQuery(
    trpc.message.thread.infiniteQueryOptions(
      { conversationId, limit: 30 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialCursor: null,
      },
    ),
  );

  // Pages arrive newest-batch-first (page 0 = latest window), each page
  // already oldest→newest internally — reverse the page order so the whole
  // list renders chronologically top-to-bottom.
  const messages =
    threadQuery.data?.pages
      .slice()
      .reverse()
      .flatMap((page) => page.items) ?? [];

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="flex-1">
        <MessageScrollerViewport preserveScrollOnPrepend>
          <MessageScrollerContent className="px-4 py-4">
            <Show when={threadQuery.hasNextPage}>
              <div className="flex justify-center pb-4">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  disabled={threadQuery.isFetchingNextPage}
                  onClick={() => threadQuery.fetchNextPage()}
                >
                  {threadQuery.isFetchingNextPage
                    ? 'Loading...'
                    : 'Load earlier messages'}
                </Button>
              </div>
            </Show>

            <For each={messages}>
              {(message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  <MessageBubble
                    message={message}
                    isOwn={message.sender.id === currentUserId}
                  />
                </MessageScrollerItem>
              )}
            </For>
          </MessageScrollerContent>
        </MessageScrollerViewport>

        <MessageScrollerButton direction="end" />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
