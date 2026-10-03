import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { ArrowLeft, Lock, Pencil } from 'lucide-react';
import { Match, Show, Switch } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { useSession } from '@/hooks/use-session';
import { seo } from '@/lib/seo';
import { useTRPC } from '@/utils/trpc';
import { CommunityContent } from '@/routes/(yapper)/-components/community-content';
import { DialogCreateCommunity } from '@/routes/(yapper)/-components/dialog-create-community';
import {
  CommunityCover,
  MemberCount,
  useCommunityMembership,
} from '@/routes/(yapper)/-components/community-card';

export const Route = createFileRoute('/(yapper)/communities/$communityId/')({
  pendingMinMs: 0,
  head: () => ({ meta: seo({ title: 'Community' }) }),
  component: CommunityPage,
});

function CommunityPage() {
  const { communityId } = Route.useParams();
  const router = useRouter();
  const trpc = useTRPC();
  const { data: session } = useSession();
  const { join, leave, requestJoin, cancelRequest } = useCommunityMembership();

  const communityQuery = useQuery(
    trpc.community.byId.queryOptions({ id: communityId }),
  );
  const community = communityQuery.data;

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center gap-4 border-b px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.history.back()}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="truncate font-bold">{community?.name ?? 'Community'}</h1>
      </header>

      <Switch>
        <Match when={communityQuery.isPending}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Loading...
          </p>
        </Match>
        <Match when={communityQuery.isError}>
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Community not found.
          </p>
        </Match>
        <Match when={community}>
          {(c) => (
            <>
              <CommunityCover
                coverKey={c.coverKey}
                name={c.name}
                className="h-40 w-full"
                width={1280}
                height={320}
              />
              <div className="border-border flex flex-col gap-3 border-b p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-xl font-bold">
                      {c.name}
                      <Show when={c.visibility === 'private'}>
                        <Lock className="text-muted-foreground size-4" />
                      </Show>
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {c.visibility === 'private' ? 'Private' : 'Public'} ·{' '}
                      <MemberCount count={c.memberCount} />
                    </p>
                  </div>

                  <Switch>
                    <Match when={!session}>{null}</Match>
                    <Match when={c.role === 'owner'}>
                      <DialogCreateCommunity
                        community={c}
                        trigger={
                          <Button variant="secondary" className="rounded-full">
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                        }
                      />
                    </Match>
                    <Match when={c.role}>
                      <Button
                        variant="secondary"
                        className="rounded-full"
                        disabled={leave.isPending}
                        onClick={() => leave.mutate({ id: c.id })}
                      >
                        Leave
                      </Button>
                    </Match>
                    <Match when={c.visibility === 'public'}>
                      <Button
                        className="rounded-full"
                        disabled={join.isPending}
                        onClick={() => join.mutate({ id: c.id })}
                      >
                        Join
                      </Button>
                    </Match>
                    <Match when={c.requested}>
                      <Button
                        variant="secondary"
                        className="rounded-full"
                        disabled={cancelRequest.isPending}
                        onClick={() => cancelRequest.mutate({ id: c.id })}
                      >
                        Requested
                      </Button>
                    </Match>
                    <Match when={true}>
                      <Button
                        className="rounded-full"
                        disabled={requestJoin.isPending}
                        onClick={() => requestJoin.mutate({ id: c.id })}
                      >
                        Request to join
                      </Button>
                    </Match>
                  </Switch>
                </div>

                <p className="text-sm whitespace-pre-wrap">{c.description}</p>

                <Link
                  to="/profile/$userId"
                  params={{ userId: c.owner.id }}
                  className="flex items-center gap-2 text-sm"
                >
                  <UserAvatar
                    name={c.owner.name}
                    image={c.owner.image}
                    className="size-6"
                  />
                  <span className="text-muted-foreground">Created by</span>
                  <span className="flex items-center gap-1 font-bold">
                    {c.owner.name}
                    <Show when={c.owner.verified}>
                      <VerifiedBadge />
                    </Show>
                  </span>
                </Link>
              </div>

              <CommunityContent
                communityId={c.id}
                visibility={c.visibility}
                role={c.role}
                pendingRequestCount={c.pendingRequestCount}
              />
            </>
          )}
        </Match>
      </Switch>
    </main>
  );
}
