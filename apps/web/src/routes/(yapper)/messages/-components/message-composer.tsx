import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { Button } from '@yapper/ui/components/button';
import { Textarea } from '@yapper/ui/components/textarea';
import { SendHorizontal } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
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

export function MessageComposer({
  conversationId,
}: {
  conversationId: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [text, setText] = useState('');
  const { data: session } = authClient.useSession();

  const send = useMutation(
    trpc.message.send.mutationOptions({
      onMutate: async ({ body }) => {
        if (!session) return null;
        const threadKey = trpc.message.thread.infiniteQueryKey({
          conversationId,
        });

        await queryClient.cancelQueries({ queryKey: threadKey });
        const previousThread = queryClient.getQueryData<ThreadData>(threadKey);
        const now = new Date().toISOString();

        queryClient.setQueryData(threadKey, (old: ThreadData | undefined) => {
          if (!old || old.pages.length === 0) return old;
          // Page 0 is always the most recent window — the newest message
          // belongs at the end of that page's (already oldest→newest) items.
          const pages = old.pages.map((page, i) =>
            i === 0
              ? {
                  ...page,
                  items: [
                    ...page.items,
                    {
                      id: `temp-${crypto.randomUUID()}`,
                      conversationId,
                      senderId: session.user.id,
                      body,
                      createdAt: now,
                      sender: {
                        id: session.user.id,
                        name: session.user.name,
                        username: session.user.username ?? null,
                        displayUsername: session.user.displayUsername ?? null,
                        image: session.user.image ?? null,
                      },
                    },
                  ],
                }
              : page,
          );
          return { ...old, pages };
        });

        queryClient.setQueriesData(
          { queryKey: trpc.message.list.infiniteQueryKey() },
          (old: ListData | undefined) => {
            if (!old) return old;
            const preview = body.slice(0, 140);
            const pages = old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === conversationId
                  ? {
                      ...item,
                      lastMessagePreview: preview,
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

        return { previousThread, threadKey };
      },
      onError: (_error, variables, context) => {
        if (context?.previousThread) {
          queryClient.setQueryData(context.threadKey, context.previousThread);
        }
        setText(variables.body);
        toast.error('Message failed to send');
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.message.thread.infiniteQueryKey({ conversationId }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.message.list.infiniteQueryKey(),
        });
      },
    }),
  );

  const handleSend = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    setText('');
    send.mutate({ conversationId, body });
  };

  return (
    <div className="border-border flex items-end gap-2 border-t p-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Start a new message"
        rows={1}
        className="max-h-40 min-h-9 flex-1 resize-none rounded-full py-2"
      />
      <Button
        size="icon-sm"
        className="shrink-0 rounded-full"
        disabled={!text.trim() || send.isPending}
        onClick={handleSend}
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}
