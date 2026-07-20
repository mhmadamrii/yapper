import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

import { For, Match, Show, Switch } from '@/components/control-flow';
import { PostCard } from '@/components/home/post-card';
import { PostCardMenu } from '@/components/home/post-card-menu';
import { ProfileHoverCard } from '@/components/profile-hover-card';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { authClient } from '@/lib/auth-client';
import { imageKitUrl } from '@/lib/imagekit';
import { useSetFollow } from '@/lib/use-set-follow';
import { useSetLike } from '@/lib/use-set-like';
import { useSetSave } from '@/lib/use-set-save';
import { formatCount, formatPostTimestamp } from '@/lib/utils';
import { FeedSkeleton } from '@/routes/(yapper)/-components/app-skeletons';
import { DialogCreateReply } from '@/routes/(yapper)/-components/dialog-create-reply';
import { useTRPC } from '@/utils/trpc';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@yapper/ui/components/dropdown-menu';

import {
  ArrowLeft,
  Bookmark,
  Heart,
  MessageCircle,
  Repeat2,
  Share,
  SlidersHorizontal,
} from 'lucide-react';

type ReplySort = 'top' | 'oldest' | 'newest';
type ReplyLayout = 'linear' | 'threaded';
type PostById = inferRouterOutputs<AppRouter>['post']['byId'];

export const Route = createFileRoute('/(yapper)/post/$postId')({
  component: PostDetailPage,
});

function PostDetailPage() {
  const { postId } = Route.useParams();
  const router = useRouter();
  const trpc = useTRPC();

  const [replySort, setReplySort] = useState<ReplySort>('top');
  const [replyLayout, setReplyLayout] = useState<ReplyLayout>('linear');

  const postQuery = useQuery(
    trpc.post.byId.queryOptions({ id: postId, replySort }),
  );

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.history.back()}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-bold">Post</h1>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" />}
          >
            <SlidersHorizontal className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card w-56">
            <DropdownMenuRadioGroup
              value={replyLayout}
              onValueChange={(value) => setReplyLayout(value as ReplyLayout)}
            >
              <DropdownMenuLabel>Show replies as</DropdownMenuLabel>
              <DropdownMenuRadioItem value="linear">
                Linear
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="threaded">
                Threaded
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={replySort}
              onValueChange={(value) => setReplySort(value as ReplySort)}
            >
              <DropdownMenuLabel>Reply sorting</DropdownMenuLabel>
              <DropdownMenuRadioItem value="top">
                Top replies first
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest">
                Oldest replies first
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="newest">
                Newest replies first
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Switch>
        <Match when={postQuery.isPending}>
          <FeedSkeleton />
        </Match>

        <Match when={postQuery.error}>
          {(error) => (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              {error.message}
            </p>
          )}
        </Match>

        <Match when={postQuery.data}>
          {(post) => (
            <>
              <Show when={post.replyTo}>
                {(parent) => <PostCard post={parent} threadLine />}
              </Show>
              <PostDetail post={post} />
              <ReplyDialogRow post={post} />
              <For each={post.replies}>
                {(reply) => <PostCard key={reply.id} post={reply} />}
              </For>
            </>
          )}
        </Match>
      </Switch>
    </main>
  );
}

// Bluesky-style reply row: looks like an inline composer, but opens the
// reply dialog. Hidden when signed out, same as the old inline composer.
function ReplyDialogRow({ post }: { post: PostById }) {
  const { data: session } = authClient.useSession();

  return (
    <Show when={session}>
      {(s) => (
        <DialogCreateReply
          post={post}
          trigger={
            <button className="border-border hover:bg-accent/30 flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors">
              <UserAvatar
                name={s.user.name}
                image={s.user.image}
                className="size-9 shrink-0"
              />
              <span className="text-muted-foreground">Write your reply</span>
            </button>
          }
        />
      )}
    </Show>
  );
}

function PostDetail({ post }: { post: PostById }) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const setLike = useSetLike();
  const setSave = useSetSave();
  const setFollow = useSetFollow();
  const handle = post.author.username ?? 'unknown';

  const goToProfile = () =>
    navigate({ to: '/profile/$userId', params: { userId: post.author.id } });

  return (
    <article className="border-border relative border-b px-4 pt-4 pb-3">
      {/* Continues the thread line from the parent card into this avatar:
          left-10 = px-4 (16px) + half the size-12 avatar (24px), then
          -translate-x-1/2 centers the 1px line on that axis — matching the
          parent card's centered w-12 avatar column exactly. */}
      <Show when={post.replyTo != null}>
        <div className="bg-border absolute top-0 left-10 h-4 w-px -translate-x-1/2" />
      </Show>
      <div className="flex items-center gap-3">
        <ProfileHoverCard userId={post.author.id}>
          <button
            onClick={goToProfile}
            className="h-fit shrink-0 cursor-pointer"
          >
            <UserAvatar
              name={post.author.name}
              image={post.author.image}
              className="size-12 shrink-0"
            />
          </button>
        </ProfileHoverCard>
        <div className="min-w-0 flex-1">
          <ProfileHoverCard userId={post.author.id}>
            <button
              onClick={goToProfile}
              className="flex min-w-0 cursor-pointer items-center gap-1 font-bold hover:underline"
            >
              <span className="truncate">{post.author.name}</span>
              {post.author.emailVerified && <VerifiedBadge />}
            </button>
          </ProfileHoverCard>
          <p className="text-muted-foreground truncate text-sm">@{handle}</p>
        </div>
        <Show when={session?.user.id !== post.author.id}>
          <Button
            variant={post.author.followedByMe ? 'secondary' : 'default'}
            className="shrink-0 rounded-full px-4"
            onClick={() => setFollow(post.author.id, !post.author.followedByMe)}
          >
            {post.author.followedByMe ? 'Following' : 'Follow'}
          </Button>
        </Show>
      </div>

      <p className="mt-3 text-xl leading-normal whitespace-pre-wrap">
        {post.content}
      </p>

      <Show when={post.media.length > 0}>
        <div
          className={
            post.media.length === 1 ? 'mt-3' : 'mt-3 grid grid-cols-2 gap-1.5'
          }
        >
          <For each={post.media}>
            {(m) => (
              <img
                key={m.id}
                src={imageKitUrl(m.filePath, 'w-1200,f-auto,q-auto')}
                alt={m.altText ?? ''}
                width={m.width}
                height={m.height}
                className="border-border w-full rounded-xl border object-cover"
              />
            )}
          </For>
        </div>
      </Show>

      <p className="text-muted-foreground border-border mt-3 border-b pb-3 text-sm">
        {formatPostTimestamp(post.createdAt)}
      </p>

      <Show when={post.likeCount > 0 || post.repostCount > 0}>
        <div className="border-border flex items-center gap-4 border-b py-3 text-sm">
          <Show when={post.likeCount > 0}>
            <span>
              <span className="font-bold">{formatCount(post.likeCount)}</span>{' '}
              <span className="text-muted-foreground">
                {post.likeCount === 1 ? 'like' : 'likes'}
              </span>
            </span>
          </Show>
          <Show when={post.repostCount > 0}>
            <span>
              <span className="font-bold">{formatCount(post.repostCount)}</span>{' '}
              <span className="text-muted-foreground">
                {post.repostCount === 1 ? 'repost' : 'reposts'}
              </span>
            </span>
          </Show>
        </div>
      </Show>

      <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
        <DialogCreateReply
          post={post}
          trigger={
            <button className="hover:text-foreground flex items-center gap-1.5 transition-colors">
              <MessageCircle className="size-5" />
              {formatCount(post.replyCount)}
            </button>
          }
        />
        <button className="flex items-center gap-1.5 transition-colors hover:text-green-500">
          <Repeat2 className="size-5" />
          {formatCount(post.repostCount)}
        </button>
        <button
          onClick={() => setLike(post.id, !post.likedByMe)}
          className={`flex items-center gap-1.5 transition-colors hover:text-red-500 ${
            post.likedByMe ? 'text-red-500' : ''
          }`}
        >
          <Heart
            className="size-5"
            fill={post.likedByMe ? 'currentColor' : 'none'}
          />
          {formatCount(post.likeCount)}
        </button>
        <div className="flex w-[20%] items-center justify-between gap-2">
          <button
            onClick={() => setSave(post.id, !post.savedByMe)}
            className={`hover:text-foreground transition-colors ${
              post.savedByMe ? 'text-primary' : ''
            }`}
          >
            <Bookmark
              className="size-5"
              fill={post.savedByMe ? 'currentColor' : 'none'}
            />
          </button>
          <button className="hover:text-foreground transition-colors">
            <Share className="size-5" />
          </button>
          <PostCardMenu post={post} />
        </div>
      </div>
    </article>
  );
}
