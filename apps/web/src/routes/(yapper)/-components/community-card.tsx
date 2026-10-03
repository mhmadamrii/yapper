import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Lock, Users } from 'lucide-react';
import { Show } from '@/components/control-flow';
import { useSession } from '@/hooks/use-session';
import { mediaUrl } from '@/lib/media';
import { toast } from '@/lib/toast';
import { useTRPC } from '@/utils/trpc';

export interface CommunitySummary {
  id: string;
  name: string;
  description: string;
  coverKey: string | null;
  visibility: 'public' | 'private';
  memberCount: number;
}

export function useCommunityMembership() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.community.pathKey() });

  const join = useMutation(
    trpc.community.join.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );
  const leave = useMutation(
    trpc.community.leave.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );

  const requestJoin = useMutation(
    trpc.community.requestJoin.mutationOptions({
      onSuccess: () => {
        toast.success('Request sent');
        invalidate();
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const cancelRequest = useMutation(
    trpc.community.cancelRequest.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => toast.error(error.message),
    }),
  );

  return { join, leave, requestJoin, cancelRequest };
}

export function CommunityCover({
  coverKey,
  name,
  className,
  width = 400,
  height = 400,
}: {
  coverKey: string | null;
  name: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Show
      when={coverKey}
      fallback={
        <div
          className={`bg-accent text-muted-foreground flex items-center justify-center ${className ?? ''}`}
        >
          <Users className="size-1/3" />
        </div>
      }
    >
      {(key) => (
        <img
          src={mediaUrl(key, { width, height, gravity: 'sm' })}
          alt={name}
          className={`object-cover ${className ?? ''}`}
        />
      )}
    </Show>
  );
}

export function MemberCount({ count }: { count: number }) {
  return (
    <span>
      {count.toLocaleString()} {count === 1 ? 'member' : 'members'}
    </span>
  );
}

export function CommunityRow({
  community,
  joined,
}: {
  community: CommunitySummary;
  joined: boolean;
}) {
  const { data: session } = useSession();
  const { join, leave } = useCommunityMembership();
  const isPublic = community.visibility === 'public';

  return (
    <div className="border-border hover:bg-accent/30 flex items-center gap-3 border-b px-4 py-3 transition-colors">
      <Link
        to="/communities/$communityId"
        params={{ communityId: community.id }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <CommunityCover
          coverKey={community.coverKey}
          name={community.name}
          className="size-14 shrink-0 rounded-xl"
          width={160}
          height={160}
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-bold">
            {community.name}
            <Show when={!isPublic}>
              <Lock className="text-muted-foreground size-3.5 shrink-0" />
            </Show>
          </p>
          <p className="text-muted-foreground line-clamp-1 text-sm">
            {community.description}
          </p>
          <p className="text-muted-foreground text-xs">
            <MemberCount count={community.memberCount} />
          </p>
        </div>
      </Link>

      <Show when={session && isPublic && !joined}>
        <Button
          size="sm"
          className="rounded-full"
          disabled={join.isPending}
          onClick={() => join.mutate({ id: community.id })}
        >
          Join
        </Button>
      </Show>
      <Show when={joined}>
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full"
          disabled={leave.isPending}
          onClick={() => leave.mutate({ id: community.id })}
        >
          Joined
        </Button>
      </Show>
    </div>
  );
}
