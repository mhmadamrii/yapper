import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from '@/lib/toast';
import {
  LogOut,
  MoreVertical,
  Pencil,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { Button } from '@yapper/ui/components/button';
import { Input } from '@yapper/ui/components/input';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@yapper/ui/components/dialog';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@yapper/ui/components/dropdown-menu';

import { For, Show } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { useTRPC } from '@/utils/trpc';

interface Person {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

export function GroupSettingsDropdown({
  conversationId,
  isOwner,
  members,
}: {
  conversationId: string;
  isOwner: boolean;
  members: Person[];
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [name, setName] = useState('');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const invalidateList = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.message.list.infiniteQueryKey(),
    });

  const rename = useMutation(
    trpc.message.rename.mutationOptions({
      onSuccess: () => {
        invalidateList();
        setRenameOpen(false);
        toast.success('Group renamed');
      },
      onError: () => toast.error('Could not rename group'),
    }),
  );

  const removeMember = useMutation(
    trpc.message.removeMember.mutationOptions({
      onSuccess: () => invalidateList(),
      onError: () => toast.error('Could not remove member'),
    }),
  );

  const leave = useMutation(
    trpc.message.leave.mutationOptions({
      onSuccess: () => {
        invalidateList();
        navigate({ to: '/messages' });
      },
      onError: () => toast.error('Could not leave group'),
    }),
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Show when={isOwner}>
            <DropdownMenuItem
              onClick={() => {
                setName('');
                setRenameOpen(true);
              }}
            >
              <Pencil />
              Rename group
            </DropdownMenuItem>
          </Show>
          <DropdownMenuItem onClick={() => setMembersOpen(true)}>
            <UserPlus />
            Manage members
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => leave.mutate({ conversationId })}
          >
            <LogOut />
            Leave group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename group</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            className="w-full rounded-full"
            disabled={!name.trim() || rename.isPending}
            onClick={() => rename.mutate({ conversationId, name: name.trim() })}
          >
            Save
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Members</DialogTitle>
          </DialogHeader>

          <AddMemberSearch
            conversationId={conversationId}
            existingIds={members.map((m) => m.id)}
            onAdded={invalidateList}
          />

          <div className="flex flex-col gap-1">
            <For
              each={members}
              fallback={
                <p className="text-muted-foreground py-2 text-sm">
                  No other members
                </p>
              }
            >
              {(member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2"
                >
                  <UserAvatar
                    name={member.name}
                    image={member.image}
                    className="size-9 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{member.name}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      @{member.username ?? 'unknown'}
                    </p>
                  </div>
                  <Show when={isOwner}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={removeMember.isPending}
                      onClick={() =>
                        removeMember.mutate({
                          conversationId,
                          userId: member.id,
                        })
                      }
                    >
                      <UserMinus className="text-destructive size-4" />
                    </Button>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddMemberSearch({
  conversationId,
  existingIds,
  onAdded,
}: {
  conversationId: string;
  existingIds: string[];
  onAdded: () => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const trpc = useTRPC();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const searchQuery = useQuery(
    trpc.message.searchRecipients.queryOptions(
      { query: debounced },
      { enabled: debounced.length > 0 },
    ),
  );

  const addMember = useMutation(
    trpc.message.addMember.mutationOptions({
      onSuccess: () => {
        onAdded();
        setQuery('');
      },
      onError: () => toast.error('Could not add member'),
    }),
  );

  const results = (searchQuery.data ?? []).filter(
    (person) => !existingIds.includes(person.id),
  );

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Add someone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Show when={results.length > 0}>
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          <For each={results}>
            {(person) => (
              <button
                key={person.id}
                disabled={addMember.isPending}
                onClick={() =>
                  addMember.mutate({ conversationId, userId: person.id })
                }
                className="hover:bg-accent/50 flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors disabled:opacity-50"
              >
                <UserAvatar
                  name={person.name}
                  image={person.image}
                  className="size-8 shrink-0"
                />
                <p className="truncate text-sm font-medium">{person.name}</p>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
