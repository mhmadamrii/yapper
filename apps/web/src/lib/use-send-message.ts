import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import { useTRPC } from '@/utils/trpc';

import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';
import type { InfiniteData } from '@tanstack/react-query';

type ThreadPage = inferRouterOutputs<AppRouter>['message']['thread'];
type ThreadData = InfiniteData<
  ThreadPage,
  { createdAt: string; id: string } | null
>;
type ListPage = inferRouterOutputs<AppRouter>['message']['list'];
type ListData = InfiniteData<
  ListPage,
  { lastMessageAt: string; id: string } | null
>;

// Client-only delivery state layered on top of a server message. Messages that
// came from the server carry no `status` — they are, by definition, sent.
export type MessageStatus = 'sending' | 'failed';
export type ThreadMessage = ThreadPage['items'][number] & {
  status?: MessageStatus;
};

export const TEMP_ID_PREFIX = 'temp-';
export const isTempMessage = (id: string) => id.startsWith(TEMP_ID_PREFIX);

/**
 * Optimistic message send. The bubble is inserted into the thread cache
 * immediately as `sending`, swapped for the server's copy on success, and kept
 * on screen as `failed` (with a retry) on error rather than rolled back — a
 * message the user typed should never silently vanish.
 */
export function useSendMessage(conversationId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  // Partial key: the thread is queried with `{ conversationId, limit }`, so
  // matching on `{ conversationId }` alone hits the live entry.
  const threadKey = trpc.message.thread.infiniteQueryKey({ conversationId });

  const patchMessages = (
    update: (items: ThreadMessage[]) => ThreadMessage[],
  ) => {
    queryClient.setQueriesData(
      { queryKey: threadKey },
      (old: ThreadData | undefined) => {
        if (!old || old.pages.length === 0) return old;
        // Page 0 is the newest window; temp/failed messages live only there.
        const pages = old.pages.map((page, i) =>
          i === 0
            ? { ...page, items: update(page.items as ThreadMessage[]) }
            : page,
        );
        return { ...old, pages };
      },
    );
  };

  const send = useMutation(
    trpc.message.send.mutationOptions({
      onMutate: async ({ body }) => {
        if (!session) return null;
        await queryClient.cancelQueries({ queryKey: threadKey });

        const tempId = `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;
        const now = new Date().toISOString();

        const optimistic = {
          id: tempId,
          conversationId,
          senderId: session.user.id,
          body,
          createdAt: now,
          status: 'sending',
          sender: {
            id: session.user.id,
            name: session.user.name,
            username: session.user.username ?? null,
            displayUsername: session.user.displayUsername ?? null,
            image: session.user.image ?? null,
          },
        } as unknown as ThreadMessage;

        patchMessages((items) => [...items, optimistic]);

        queryClient.setQueriesData(
          { queryKey: trpc.message.list.infiniteQueryKey() },
          (old: ListData | undefined) => {
            if (!old) return old;
            const pages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === conversationId
                  ? {
                      ...item,
                      lastMessagePreview: body.slice(0, 140),
                      lastMessageAt: now,
                      lastMessageSenderId: session.user.id,
                      hasUnread: false,
                    }
                  : item,
              ),
            }));
            return { ...old, pages };
          },
        );

        return { tempId };
      },
      onSuccess: (data, _variables, context) => {
        if (!context) return;
        const createdAt = new Date(data.createdAt).toISOString();
        patchMessages((items) => {
          const realArrived = items.some((m) => m.id === data.id);
          // The SSE echo can beat the mutation response; in that case the
          // temp bubble is already gone or just needs dropping.
          if (realArrived) return items.filter((m) => m.id !== context.tempId);
          return items.map((m) =>
            m.id === context.tempId
              ? { ...m, id: data.id, createdAt, status: undefined }
              : m,
          );
        });
      },
      onError: (_error, _variables, context) => {
        if (!context) return;
        patchMessages((items) =>
          items.map((m) =>
            m.id === context.tempId ? { ...m, status: 'failed' as const } : m,
          ),
        );
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.message.list.infiniteQueryKey(),
        });
      },
    }),
  );

  const sendMessage = (body: string) => {
    send.mutate({ conversationId, body });
  };

  // Drops the failed bubble and sends the same body again as a fresh message.
  const retryMessage = (failed: ThreadMessage) => {
    patchMessages((items) => items.filter((m) => m.id !== failed.id));
    sendMessage(failed.body);
  };

  return { sendMessage, retryMessage };
}
