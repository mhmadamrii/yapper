import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@yapper/ui/components/input';
import {
  Compass,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { For, Show } from '@/components/control-flow';
import { useSession } from '@/hooks/use-session';
import { useTRPC } from '@/utils/trpc';

export function SidebarRight() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const trendingQuery = useQuery(
    trpc.trending.list.queryOptions(
      { limit: 5 },
      // The cron recomputes every 5 minutes — polling faster than that would
      // only ever refetch the same snapshot.
      { refetchInterval: 5 * 60 * 1000, staleTime: 60 * 1000 },
    ),
  );
  const trending = trendingQuery.data;

  // Dev/testing only: the real trigger is the Worker's 5-min Cloudflare
  // Cron, which never fires in local dev. This lets the snapshot be forced
  // without waiting for a deploy.
  const recompute = useMutation(
    trpc.trending.recompute.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.trending.list.queryKey(),
        });
      },
    }),
  );

  return (
    <aside className="sticky top-0 hidden h-svh w-80 flex-col gap-5 px-6 py-6 lg:flex">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input placeholder="Search" className="rounded-full pl-9" />
      </div>

      {session && (
        <div className="flex flex-col items-start gap-1">
          <button className="hover:bg-accent flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors">
            <Compass className="text-primary size-4" />
            Discover
          </button>
          <button className="bg-primary text-primary-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
            <ListFilter className="size-4" />
            Following
          </button>
          <button className="hover:bg-accent text-muted-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors">
            <Plus className="size-4" />
            More feeds
          </button>
        </div>
      )}

      {/* Logged-in-only recompute control stays visible even with an empty
          snapshot, since that's precisely the state it's meant to fix. */}
      <Show when={(trending && trending.length > 0) || session}>
        <div className="border-border rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <TrendingUp className="size-4" />
              Trending
            </div>
            <Show when={session}>
              <button
                onClick={() => recompute.mutate()}
                disabled={recompute.isPending}
                aria-label="Recompute trending now"
                title="Dev: recompute trending now (cron doesn't run in local dev)"
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full p-1 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-3.5 ${recompute.isPending ? 'animate-spin' : ''}`}
                />
              </button>
            </Show>
          </div>
          <Show
            when={trending && trending.length > 0}
            fallback={
              <p className="text-muted-foreground text-sm">No trends yet.</p>
            }
          >
            <ol className="flex flex-col gap-2">
              <For each={trending ?? []}>
                {(topic, i) => (
                  <li key={topic.hashtag} className="flex gap-3 text-sm">
                    <span className="text-muted-foreground">{i + 1}.</span>
                    <span className="flex flex-col">
                      <span className="font-medium">#{topic.hashtag}</span>
                      <span className="text-muted-foreground text-xs">
                        {topic.recentAuthors}{' '}
                        {topic.recentAuthors === 1 ? 'person' : 'people'}{' '}
                        posting
                      </span>
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </div>
      </Show>

      <div className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 text-sm">
        {session && (
          <>
            <a href="#" className="hover:underline">
              Feedback
            </a>
            <span>·</span>
          </>
        )}
        <a href="#" className="hover:underline">
          Privacy
        </a>
        <span>·</span>
        <a href="#" className="hover:underline">
          Terms
        </a>
        <span>·</span>
        <a href="#" className="hover:underline">
          Help
        </a>
      </div>
    </aside>
  );
}
