import { useInfiniteQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Input } from '@yapper/ui/components/input';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { For, Match, Show, Switch } from '@/components/control-flow';
import { useSession } from '@/hooks/use-session';
import { seo } from '@/lib/seo';
import { useTRPC } from '@/utils/trpc';
import { CommunityRow } from '@/routes/(yapper)/-components/community-card';
import { DialogCreateCommunity } from '@/routes/(yapper)/-components/dialog-create-community';

export const Route = createFileRoute('/(yapper)/communities/')({
  pendingMinMs: 0,
  head: () => ({ meta: seo({ title: 'Communities' }) }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const listQuery = useInfiniteQuery(
    trpc.community.list.infiniteQueryOptions(
      { query: debounced || undefined },
      { getNextPageParam: (last) => last.nextCursor },
    ),
  );
  const communities = listQuery.data?.pages.flatMap((p) => p.items) ?? [];

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
          <h1 className="font-bold">Communities</h1>
        </div>
        <Show when={session?.user.emailVerified}>
          <DialogCreateCommunity
            trigger={
              <Button size="sm" className="rounded-full">
                <Plus className="size-4" />
                Create
              </Button>
            }
          />
        </Show>
      </header>

      <div className="p-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search communities"
            className="rounded-full pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Switch
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            No communities found.
          </p>
        }
      >
        <Match when={listQuery.isPending}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Loading...
          </p>
        </Match>
        <Match when={communities.length > 0}>
          <For each={communities}>
            {(c) => <CommunityRow key={c.id} community={c} joined={c.joined} />}
          </For>
        </Match>
      </Switch>

      <Show when={listQuery.hasNextPage}>
        <div className="flex justify-center p-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={listQuery.isFetchingNextPage}
            onClick={() => listQuery.fetchNextPage()}
          >
            {listQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      </Show>
    </main>
  );
}
