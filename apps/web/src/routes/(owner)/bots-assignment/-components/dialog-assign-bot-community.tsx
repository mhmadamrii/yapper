import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { Skeleton } from '@yapper/ui/components/skeleton';
import { cn } from '@yapper/ui/lib/utils';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { toast } from '@/lib/toast';
import { useTRPC } from '@/utils/trpc';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

export function DialogAssignBotCommunity({
  trigger,
  botId,
  botName,
  currentCommunityId,
}: {
  trigger: React.ReactElement;
  botId: string;
  botName: string;
  currentCommunityId: string | null;
}) {
  const [open, setOpen] = useState(false);
  // undefined = untouched, so the selection starts at the server value.
  const [draft, setDraft] = useState<string | null | undefined>(undefined);
  const selected = draft === undefined ? currentCommunityId : draft;

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Only fetched once the dialog is opened.
  const communitiesQuery = useQuery(
    trpc.moderation.communities.queryOptions(undefined, { enabled: open }),
  );
  const communities = communitiesQuery.data ?? [];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setDraft(undefined);
  };

  const assign = useMutation(
    trpc.moderation.assignBotCommunity.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.moderation.bots.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.community.pathKey(),
        });
        toast.success('Bot assignment updated');
        handleOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const dirty = selected !== currentCommunityId;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {botName}</DialogTitle>
          <DialogDescription>
            The bot joins the community and posts there on its schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          <Switch>
            <Match when={communitiesQuery.isPending}>
              <div className="flex flex-col gap-2 py-2">
                <For each={[0, 1, 2, 3]}>
                  {(i) => <Skeleton key={i} className="h-12 w-full" />}
                </For>
              </div>
            </Match>
            <Match when={communitiesQuery.error}>
              <p className="text-muted-foreground py-8 text-center text-sm">
                Could not load communities.
              </p>
            </Match>
            <Match when={true}>
              <div className="flex flex-col gap-1">
                <Option
                  active={selected === null}
                  onClick={() => setDraft(null)}
                  title="No community"
                  subtitle="Bot posts to the general feed"
                />
                <For each={communities}>
                  {(c) => (
                    <Option
                      key={c.id}
                      active={selected === c.id}
                      onClick={() => setDraft(c.id)}
                      title={c.name}
                      subtitle={`${c.memberCount} members · ${c.visibility}`}
                    />
                  )}
                </For>
              </div>
            </Match>
          </Switch>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={assign.isPending}
          >
            Cancel
          </Button>
          <Button
            disabled={!dirty || assign.isPending}
            onClick={() =>
              assign.mutate({ botId, communityId: selected ?? null })
            }
          >
            {assign.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Option({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hover:bg-accent/50 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
        active ? 'border-primary bg-accent/40' : 'border-transparent',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
      </div>
      <Show when={active}>
        <Check className="text-primary size-4 shrink-0" />
      </Show>
    </button>
  );
}
