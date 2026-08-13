import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Skeleton } from '@yapper/ui/components/skeleton';
import { Match, Show, Switch } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { useSession } from '@/hooks/use-session';
import { useSetFollow } from '@/lib/use-set-follow';
import { formatCount } from '@/lib/utils';
import { useTRPC } from '@/utils/trpc';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@yapper/ui/components/hover-card';

/**
 * Bluesky-style profile preview on hover. Wrap any element (author name,
 * avatar) — the profile is fetched lazily on first open, and the card's
 * clicks are fenced off from ancestor onClick handlers (PostCard navigates
 * to the post detail on click).
 */
export function ProfileHoverCard({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactElement;
}) {
  const navigate = useNavigate();
  const setFollow = useSetFollow();
  const trpc = useTRPC();

  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const userQuery = useQuery(
    trpc.user.byId.queryOptions({ id: userId }, { enabled: open }),
  );

  const goToProfile = () => navigate({ to: '/profile/$userId', params: { userId } }); // prettier-ignore

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger render={children} />
      <HoverCardContent
        align="start"
        className="w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <Switch
          fallback={
            <div className="space-y-3">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52" />
            </div>
          }
        >
          <Match when={userQuery.error}>
            {(error) => (
              <p className="text-muted-foreground text-sm">{error.message}</p>
            )}
          </Match>

          <Match when={userQuery.data}>
            {(user) => (
              <div>
                <div className="flex items-start justify-between">
                  <button onClick={goToProfile}>
                    <UserAvatar
                      name={user.name}
                      image={user.image}
                      className="size-12"
                    />
                  </button>
                  <Show when={session?.user.id !== user.id}>
                    <Button
                      size="sm"
                      variant={user.followedByMe ? 'secondary' : 'default'}
                      className="rounded-full px-4"
                      onClick={() => setFollow(user.id, !user.followedByMe)}
                    >
                      {user.followedByMe ? 'Following' : 'Follow'}
                    </Button>
                  </Show>
                </div>

                <button onClick={goToProfile} className="mt-2 block text-left">
                  <p className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 text-base font-bold hover:underline">
                    <span className="min-w-0 truncate">{user.name}</span>
                    {user.emailVerified && <VerifiedBadge />}
                  </p>
                  <p className="text-muted-foreground">
                    @{user.username ?? 'unknown'}
                  </p>
                </button>

                <div className="mt-2 flex gap-4 text-sm">
                  <span>
                    <span className="font-bold">
                      {formatCount(user.followerCount)}
                    </span>{' '}
                    <span className="text-muted-foreground">followers</span>
                  </span>
                  <span>
                    <span className="font-bold">
                      {formatCount(user.followingCount)}
                    </span>{' '}
                    <span className="text-muted-foreground">following</span>
                  </span>
                </div>
              </div>
            )}
          </Match>
        </Switch>
      </HoverCardContent>
    </HoverCard>
  );
}
