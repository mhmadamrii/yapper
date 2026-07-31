import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/lib/toast';
import { Check, Users, X } from 'lucide-react';
import { Button } from '@yapper/ui/components/button';
import { Input } from '@yapper/ui/components/input';
import { For, Show, Switch, Match } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { useTRPC } from '@/utils/trpc';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

interface Person {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

export function DialogNewChat({ trigger }: { trigger: React.ReactElement }) {
  const navigate = useNavigate();
  const trpc = useTRPC();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<Map<string, Person>>(new Map());

  const searchQuery = useQuery(
    trpc.message.searchRecipients.queryOptions(
      { query: debounced },
      { enabled: debounced.length > 0 },
    ),
  );

  const createDirect = useMutation(trpc.message.createDirect.mutationOptions());
  const createGroup = useMutation(trpc.message.createGroup.mutationOptions());

  const reset = () => {
    setMode('direct');
    setQuery('');
    setGroupName('');
    setSelected(new Map());
  };

  const handlePickDirect = async (userId: string) => {
    try {
      const { conversationId } = await createDirect.mutateAsync({ userId });
      setOpen(false);
      reset();
      navigate({
        to: '/messages/$conversationId',
        params: { conversationId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not start chat',
      );
    }
  };

  const toggleSelected = (person: Person) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) {
        next.delete(person.id);
      } else {
        next.set(person.id, person);
      }
      return next;
    });
  };

  const handleCreateGroup = async () => {
    try {
      const { conversationId } = await createGroup.mutateAsync({
        name: groupName.trim(),
        memberIds: [...selected.keys()],
      });
      setOpen(false);
      reset();
      navigate({
        to: '/messages/$conversationId',
        params: { conversationId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create group',
      );
    }
  };

  const canCreateGroup = groupName.trim().length > 0 && selected.size > 0;

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {mode === 'direct' ? 'New message' : 'New group'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode(mode === 'direct' ? 'group' : 'direct')}
            >
              <Users className="size-4" />
              {mode === 'direct' ? 'New group' : 'Cancel'}
            </Button>
          </div>
        </DialogHeader>

        <Show when={mode === 'group'}>
          <Input
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </Show>

        <Show when={selected.size > 0}>
          <div className="flex flex-wrap gap-1.5">
            <For each={[...selected.values()]}>
              {(person) => (
                <span
                  key={person.id}
                  className="bg-secondary flex items-center gap-1 rounded-full py-1 pr-1 pl-2.5 text-sm"
                >
                  {person.name}
                  <button
                    onClick={() => toggleSelected(person)}
                    className="hover:bg-accent rounded-full p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </For>
          </div>
        </Show>

        <Input
          autoFocus
          placeholder="Search people"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          <Show when={debounced.length === 0}>
            <p className="text-muted-foreground py-6 text-center text-sm">
              Search for someone to message.
            </p>
          </Show>

          <Show when={debounced.length > 0 && searchQuery.data?.length === 0}>
            <p className="text-muted-foreground py-6 text-center text-sm">
              No one found.
            </p>
          </Show>

          <For each={searchQuery.data ?? []}>
            {(person) => (
              <button
                key={person.id}
                disabled={createDirect.isPending}
                onClick={() =>
                  mode === 'direct'
                    ? handlePickDirect(person.id)
                    : toggleSelected(person)
                }
                className="hover:bg-accent/50 flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors disabled:opacity-50"
              >
                <UserAvatar
                  name={person.name}
                  image={person.image}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{person.name}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    @{person.username ?? 'unknown'}
                  </p>
                </div>
                <Show when={mode === 'group' && selected.has(person.id)}>
                  <Check className="text-primary size-4 shrink-0" />
                </Show>
              </button>
            )}
          </For>
        </div>

        <Switch>
          <Match when={mode === 'group'}>
            <Button
              className="w-full rounded-full"
              disabled={!canCreateGroup || createGroup.isPending}
              onClick={handleCreateGroup}
            >
              {createGroup.isPending ? 'Creating...' : 'Create group'}
            </Button>
          </Match>
        </Switch>
      </DialogContent>
    </Dialog>
  );
}
