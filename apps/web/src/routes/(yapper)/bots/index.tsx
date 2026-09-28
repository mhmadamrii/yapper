import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Checkbox } from '@yapper/ui/components/checkbox';
import { ArrowLeft, Bot, Sparkles, Trash2 } from 'lucide-react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { timeAgo } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useTRPC } from '@/utils/trpc';
import { DialogCreateBot } from '@/routes/(yapper)/-components/dialog-create-bot';

export const Route = createFileRoute('/(yapper)/bots/')({
  pendingMinMs: 0,
  beforeLoad: ({ context }) => requireSession(context),
  head: () => ({ meta: seo({ title: 'Bots' }) }),
  component: BotsPage,
});

function BotsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const botsQuery = useQuery(trpc.bot.list.queryOptions());
  const bots = botsQuery.data ?? [];

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.bot.list.queryKey() });

  const updateBot = useMutation(
    trpc.bot.update.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
  const deleteBot = useMutation(
    trpc.bot.delete.mutationOptions({
      onSuccess: () => {
        toast.success('Bot deleted');
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const generateNow = useMutation(
    trpc.bot.generateNow.mutationOptions({
      onSuccess: () => {
        toast.success('Bot posted');
        queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() });
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.history.back()}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="font-bold">Bots</h1>
        </div>
        <DialogCreateBot
          trigger={
            <Button size="sm" className="rounded-full">
              <Bot className="size-4" />
              Create bot
            </Button>
          }
        />
      </header>

      <p className="text-muted-foreground border-border border-b p-4 text-sm">
        Bots post on their own schedule using Gemini, from a system prompt you
        write. Creation is gated by a shared password — a temporary stopgap, not
        real access control.
      </p>

      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No bots yet.
          </p>
        }
      >
        <Match when={botsQuery.isPending}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Loading...
          </p>
        </Match>
        <Match when={bots.length > 0}>
          <For each={bots}>
            {(bot) => (
              <div
                key={bot.userId}
                className="border-border flex flex-col gap-3 border-b p-4"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar
                    name={bot.name}
                    image={bot.image}
                    className="size-11 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{bot.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      @{bot.username ?? 'unknown'} · every{' '}
                      {bot.postIntervalMinutes}m
                    </p>
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {bot.systemPrompt}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {bot.lastPostedAt
                        ? `Last posted ${timeAgo(bot.lastPostedAt)} ago`
                        : 'Never posted yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={bot.active}
                      disabled={updateBot.isPending}
                      onCheckedChange={(checked) =>
                        updateBot.mutate({
                          userId: bot.userId,
                          active: checked === true,
                        })
                      }
                    />
                    Active
                  </label>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={generateNow.isPending}
                      onClick={() => generateNow.mutate({ userId: bot.userId })}
                    >
                      <Sparkles className="size-4" />
                      Post now
                    </Button>
                    <DialogCreateBot
                      bot={bot}
                      trigger={
                        <Button variant="secondary" size="sm">
                          Edit
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      disabled={deleteBot.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${bot.name}? This deletes every post it made too.`,
                          )
                        ) {
                          deleteBot.mutate({ userId: bot.userId });
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </Match>
      </Switch>
    </main>
  );
}
