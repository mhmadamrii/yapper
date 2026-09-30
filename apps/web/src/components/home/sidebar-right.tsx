import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { Input } from '@yapper/ui/components/input';
import {
  Compass,
  ListFilter,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { For, Show } from '@/components/control-flow';
import { useSession } from '@/hooks/use-session';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@yapper/ui/lib/utils';
import { useTRPC } from '@/utils/trpc';

export function SidebarRight() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const trendingQuery = useQuery(
    trpc.trending.list.queryOptions(
      { limit: 5 },
      // Nothing recomputes this in the background — the snapshot only
      // changes when someone hits the refresh button below. Poll anyway so
      // one user's refresh shows up for everyone else without a reload.
      { refetchInterval: 5 * 60 * 1000, staleTime: 60 * 1000 },
    ),
  );
  const trending = trendingQuery.data;

  // The only way the trending snapshot ever gets recomputed — there is no
  // automatic scheduler. See `packages/api/src/lib/trending.ts`.
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
    <aside className="sticky top-0 hidden h-svh w-80 flex-col gap-5 px-6 py-6 lg:flex xl:w-full">
      <Show when={session} fallback={<SearchDisabled />}>
        <SidebarPeopleSearch />
      </Show>

      {session && <FeedSwitcher />}

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
                aria-label="Refresh trending"
                title="Refresh trending"
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

const FEED_LINK =
  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors';

// Discover / Following both live on "/" — Following is `/?feed=following`.
function FeedSwitcher() {
  const location = useLocation();
  const onHome = location.pathname === '/';
  const following = onHome && 'feed' in (location.search as object);

  return (
    <div className="flex flex-col items-start gap-1">
      <Link
        to="/"
        search={{}}
        className={cn(
          FEED_LINK,
          onHome && !following
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent',
        )}
      >
        <Compass
          className={cn('size-4', onHome && !following ? '' : 'text-primary')}
        />
        Discover
      </Link>
      <Link
        to="/"
        search={{ feed: 'following' }}
        className={cn(
          FEED_LINK,
          following ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
        )}
      >
        <ListFilter className="size-4" />
        Following
      </Link>
      <button
        className={cn(FEED_LINK, 'hover:bg-accent text-muted-foreground')}
      >
        <Plus className="size-4" />
        More feeds
      </button>
    </div>
  );
}

// Logged out: `user.search` is a protected procedure (excludes the viewer,
// applies their blocks), so there's nothing useful to search for without an
// account — render the box inert rather than open a popover onto nothing.
function SearchDisabled() {
  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input placeholder="Search" disabled className="rounded-full pl-9" />
    </div>
  );
}

interface PersonResult {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

function SidebarPeopleSearch() {
  const trpc = useTRPC();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const searchQuery = useQuery(
    trpc.user.search.queryOptions(
      { query: debounced },
      { enabled: debounced.length > 0 },
    ),
  );

  const goToProfile = (person: PersonResult) => {
    setOpen(false);
    setQuery('');
    navigate({ to: '/profile/$userId', params: { userId: person.id } });
  };

  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        placeholder="Search"
        className="rounded-full pl-9"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        // A real outside click blurs normally and should close the popover;
        // a click on a result inside it doesn't reach here at all, because
        // that panel's `onMouseDown` keeps focus on the input.
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            e.currentTarget.blur();
          }
        }}
      />

      <Show when={open}>
        <div
          // Keeps the input focused through the click — without this, the
          // input's blur fires before the button's click, closing the
          // popover (and unmounting this list) before the selection lands.
          onMouseDown={(e) => e.preventDefault()}
          className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl p-1 shadow-md ring-1"
        >
          <Show when={debounced.length === 0}>
            <p className="text-muted-foreground px-3 py-4 text-center text-sm">
              Search for people by name or username.
            </p>
          </Show>

          <Show when={debounced.length > 0 && searchQuery.data?.length === 0}>
            <p className="text-muted-foreground px-3 py-4 text-center text-sm">
              No one found.
            </p>
          </Show>

          <For each={searchQuery.data ?? []}>
            {(person) => (
              <button
                key={person.id}
                onClick={() => goToProfile(person)}
                className="hover:bg-accent flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
              >
                <UserAvatar
                  name={person.name}
                  image={person.image}
                  className="size-9 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{person.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    @{person.username ?? 'unknown'}
                  </p>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
