import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Skeleton } from '@yapper/ui/components/skeleton';
import { For, Match, Switch } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { useTRPC } from '@/utils/trpc';
import { DialogAssignBotCommunity } from './-components/dialog-assign-bot-community';

export const Route = createFileRoute('/(owner)/bots-assignment/')({
  pendingMinMs: 0,
  // UX guard only — every moderation procedure re-checks the owner role.
  beforeLoad: async ({ context }) => {
    await requireSession(context);
    const isOwner = await context.queryClient.ensureQueryData(
      context.trpc.moderation.isOwner.queryOptions(),
    );
    if (!isOwner) {
      throw redirect({ to: '/' });
    }
  },
  head: () => ({ meta: seo({ title: 'Bot assignments' }) }),
  component: RouteComponent,
});

function RouteComponent() {
  const trpc = useTRPC();
  const botsQuery = useQuery(trpc.moderation.bots.queryOptions());
  const bots = botsQuery.data ?? [];

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b px-4 py-3 backdrop-blur">
        <h1 className="font-bold">Bot assignments</h1>
      </header>

      <Switch>
        <Match when={botsQuery.isPending}>
          <div className="flex flex-col gap-4 p-4">
            <For each={[0, 1, 2]}>
              {(i) => <Skeleton key={i} className="h-12 w-full" />}
            </For>
          </div>
        </Match>
        <Match when={botsQuery.error}>
          <p className="text-muted-foreground py-12 text-center text-sm">
            Could not load bots.
          </p>
        </Match>
        <Match when={bots.length === 0}>
          <p className="text-muted-foreground py-12 text-center text-sm">
            No bots yet.
          </p>
        </Match>
        <Match when={true}>
          <For each={bots}>
            {(bot) => (
              <div
                key={bot.userId}
                className="border-border flex items-center gap-3 border-b px-4 py-3"
              >
                <UserAvatar
                  name={bot.name}
                  image={bot.image}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{bot.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    @{bot.username} · {bot.communityName ?? 'Not assigned'}
                  </p>
                </div>
                <DialogAssignBotCommunity
                  botId={bot.userId}
                  botName={bot.name}
                  currentCommunityId={bot.communityId}
                  trigger={
                    <Button variant="secondary" size="sm">
                      Assign
                    </Button>
                  }
                />
              </div>
            )}
          </For>
        </Match>
      </Switch>
    </main>
  );
}
