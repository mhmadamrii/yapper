import { useQuery } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import { Match, Switch } from '@/components/control-flow';
import { useTRPC } from '@/utils/trpc';

// Replies to a community bot (and @-mentions of it) get an AI answer, but
// each person can only trigger a few per window — otherwise the bot just
// goes quiet. This surfaces the remaining quota under the reply box.
// Composer variant: only renders when the target community has an active
// bot, and tells the author how to summon it.
export function CommunityBotHint({ communityId }: { communityId: string }) {
  const trpc = useTRPC();
  const botsQuery = useQuery(
    trpc.bot.inCommunity.queryOptions({ communityId }),
  );
  const bots = botsQuery.data ?? [];
  const first = bots[0];
  if (!first) return null;

  return (
    <BotQuotaHint
      botName={bots.map((b) => b.name).join(', ')}
      mention={first.username ? `@${first.username}` : undefined}
    />
  );
}

export function BotQuotaHint({
  botName,
  mention,
}: {
  botName: string;
  // Shown as "mention @x to ask" in the composer.
  mention?: string;
}) {
  const trpc = useTRPC();
  const quotaQuery = useQuery(
    trpc.bot.askQuota.queryOptions(undefined, {
      refetchInterval: 30_000,
    }),
  );
  const quota = quotaQuery.data;
  if (!quota) return null;

  const minutesLeft = quota.resetsAt
    ? Math.max(
        1,
        Math.ceil((new Date(quota.resetsAt).getTime() - Date.now()) / 60_000),
      )
    : null;

  return (
    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
      <Bot className="size-3.5 shrink-0" />
      <Switch>
        <Match when={quota.remaining === 0}>
          <span>
            {botName} won't answer right now — limit of {quota.limit} per{' '}
            {quota.windowMinutes} min reached. Try again in {minutesLeft} min.
          </span>
        </Match>
        <Match when={true}>
          <span>
            {mention
              ? `Mention ${mention} to ask ${botName}`
              : `${botName} answers replies and mentions`}{' '}
            · {quota.remaining} of {quota.limit} answers left
            {minutesLeft ? ` (next slot frees in ${minutesLeft} min)` : ''}
          </span>
        </Match>
      </Switch>
    </p>
  );
}
