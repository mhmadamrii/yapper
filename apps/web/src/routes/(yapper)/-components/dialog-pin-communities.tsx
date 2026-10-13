import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { Skeleton } from '@yapper/ui/components/skeleton';
import { ChevronDown, ChevronUp, Pin, PinOff } from 'lucide-react';
import { useState } from 'react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { toast } from '@/lib/toast';
import { useTRPC } from '@/utils/trpc';
import { CommunityCover, MemberCount } from './community-card';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

// Mirrors MAX_PINNED_COMMUNITIES on the server (`community.setPins`).
const MAX_PINNED = 3;

export function DialogPinCommunities({
  trigger,
}: {
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  // null = untouched, so the list reflects the server until the user edits.
  const [draftIds, setDraftIds] = useState<string[] | null>(null);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Only fetched once the dialog is opened.
  const mineQuery = useQuery(
    trpc.community.mine.queryOptions(undefined, { enabled: open }),
  );
  const communities = mineQuery.data ?? [];
  const byId = new Map(communities.map((c) => [c.id, c]));

  const serverPinnedIds = communities
    .filter((c) => c.pinPosition !== null)
    .sort((a, b) => a.pinPosition! - b.pinPosition!)
    .map((c) => c.id);
  const pinnedIds = draftIds ?? serverPinnedIds;
  const pinned = pinnedIds.flatMap((id) => byId.get(id) ?? []);
  const unpinned = communities.filter((c) => !pinnedIds.includes(c.id));

  const dirty =
    draftIds !== null &&
    (draftIds.length !== serverPinnedIds.length ||
      draftIds.some((id, i) => id !== serverPinnedIds[i]));

  const setPins = useMutation(
    trpc.community.setPins.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.community.pathKey(),
        });
        toast.success('Sidebar communities updated');
        handleOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setDraftIds(null);
  };

  const pin = (id: string) => {
    if (pinnedIds.length >= MAX_PINNED) return;
    setDraftIds([...pinnedIds, id]);
  };
  const unpin = (id: string) => setDraftIds(pinnedIds.filter((x) => x !== id));
  const move = (index: number, delta: -1 | 1) => {
    const next = pinnedIds.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setDraftIds(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pin communities</DialogTitle>
          <DialogDescription>
            Choose up to {MAX_PINNED} communities to show in your right sidebar,
            and set their order.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-96 overflow-y-auto">
          <Switch>
            <Match when={mineQuery.isPending}>
              <div className="flex flex-col gap-3 py-2">
                <For each={[0, 1, 2, 3]}>
                  {(i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-10 shrink-0 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Match>
            <Match when={mineQuery.error}>
              <p className="text-muted-foreground py-8 text-center text-sm">
                Could not load your communities.
              </p>
            </Match>
            <Match when={communities.length === 0}>
              <p className="text-muted-foreground py-8 text-center text-sm">
                You haven't joined any communities yet.
              </p>
            </Match>
            <Match when={true}>
              <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                Pinned ({pinned.length}/{MAX_PINNED})
              </p>
              <Show
                when={pinned.length > 0}
                fallback={
                  <p className="text-muted-foreground mb-4 text-sm">
                    Nothing pinned — your sidebar shows your most recently
                    joined communities.
                  </p>
                }
              >
                <div className="mb-4 flex flex-col gap-1">
                  <For each={pinned}>
                    {(c, i) => (
                      <div
                        key={c.id}
                        className="bg-accent/40 flex items-center gap-3 rounded-lg px-2 py-1.5"
                      >
                        <CommunityCover
                          coverKey={c.coverKey}
                          name={c.name}
                          className="size-10 shrink-0 rounded-lg"
                          width={80}
                          height={80}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {c.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            <MemberCount count={c.memberCount} />
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Move down"
                          disabled={i === pinned.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Unpin ${c.name}`}
                          onClick={() => unpin(c.id)}
                        >
                          <PinOff className="size-4" />
                        </Button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={unpinned.length > 0}>
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  Your communities
                </p>
                <div className="flex flex-col gap-1">
                  <For each={unpinned}>
                    {(c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                      >
                        <CommunityCover
                          coverKey={c.coverKey}
                          name={c.name}
                          className="size-10 shrink-0 rounded-lg"
                          width={80}
                          height={80}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {c.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            <MemberCount count={c.memberCount} />
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-full"
                          disabled={pinnedIds.length >= MAX_PINNED}
                          onClick={() => pin(c.id)}
                        >
                          <Pin className="size-3.5" />
                          Pin
                        </Button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Match>
          </Switch>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full"
            disabled={!dirty || setPins.isPending}
            onClick={() => setPins.mutate({ ids: pinnedIds })}
          >
            {setPins.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
