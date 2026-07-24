import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { env } from '@yapper/env/web';
import { useTRPC } from '@/utils/trpc';
import { getServerUrl } from './server-url';

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
type IncomingMessage = ThreadPage['items'][number];

/**
 * Pushes new messages into the currently-open thread via SSE — the inbox
 * list and unread badge stay on refetchInterval polling (matches CLAUDE.md's
 * "start with polling, upgrade to SSE where it matters": it matters for the
 * thread someone is actively looking at, not yet for the inbox row list).
 */
export function useConversationStream(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  useEffect(() => {
    if (!conversationId) return;

    const url = `${getServerUrl(env.VITE_SERVER_URL)}/conversations/${conversationId}/stream`;
    const source = new EventSource(url, { withCredentials: true });

    source.onmessage = (event) => {
      const incoming = JSON.parse(event.data) as IncomingMessage;

      queryClient.setQueryData(
        trpc.message.thread.infiniteQueryKey({ conversationId }),
        (old: ThreadData | undefined) => {
          if (!old || old.pages.length === 0) return old;
          if (old.pages[0]!.items.some((m) => m.id === incoming.id)) {
            return old;
          }
          const pages = old.pages.map((page, i) =>
            i === 0 ? { ...page, items: [...page.items, incoming] } : page,
          );
          return { ...old, pages };
        },
      );

      queryClient.setQueriesData(
        { queryKey: trpc.message.list.infiniteQueryKey() },
        (old: ListData | undefined) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === incoming.conversationId
                ? {
                    ...item,
                    lastMessagePreview: incoming.body.slice(0, 140),
                    lastMessageAt: incoming.createdAt,
                    lastMessageSenderId: incoming.senderId,
                  }
                : item,
            ),
          }));
          return { ...old, pages };
        },
      );
    };

    return () => source.close();
  }, [conversationId, queryClient, trpc]);
}
