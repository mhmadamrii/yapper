import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

import { useState } from 'react';
import { Show, For } from '@/components/control-flow';
import { cn } from '@yapper/ui/lib/utils';
import { imageKitUrl } from '@/lib/imagekit';
import { MentionText } from '@/components/mention-text';
import { ProfileHoverCard } from '@/components/profile-hover-card';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { QuotedPostPreview } from '@/components/home/quoted-post-preview';
import { useSetLike } from '@/lib/use-set-like';
import { useSetRepost } from '@/lib/use-set-repost';
import { useSetSave } from '@/lib/use-set-save';
import { PostCardMenu } from '@/components/home/post-card-menu';
import { DialogCreateReply } from '@/routes/(yapper)/-components/dialog-create-reply';
import { DialogCreateQuote } from '@/routes/(yapper)/-components/dialog-create-quote';
import { formatCount, timeAgo } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useNavigate } from '@tanstack/react-router';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@yapper/ui/components/dropdown-menu';

import {
  Bookmark,
  Heart,
  MessageCircle,
  Quote,
  Repeat2,
  Share,
} from 'lucide-react';

export type PostListItem = inferRouterOutputs<AppRouter>['post']['list']['items'][number]; // prettier-ignore

export function PostCard({
  post,
  // Thread context (e.g. the parent above a reply on the detail page):
  // draws a vertical line from the avatar to the card's bottom edge and
  // drops the bottom border so the thread reads as one column.
  threadLine = false,
}: {
  post: PostListItem;
  threadLine?: boolean;
}) {
  const navigate = useNavigate();
  const setLike = useSetLike();
  const setRepost = useSetRepost();
  const setSave = useSetSave();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const handle = post.author.username ?? 'unknown';

  const handleArticleClick = () => {
    navigate({ to: '/post/$postId', params: { postId: post.id } });
  };

  const handleProfileClick = (e: any) => {
    e.stopPropagation();
    navigate({
      to: '/profile/$userId',
      params: { userId: post.author.id },
    });
  };

  return (
    <article
      onClick={handleArticleClick}
      className={`hover:bg-accent/30 cursor-pointer px-4 py-3 transition-colors ${
        threadLine ? '' : 'border-border border-b'
      }`}
    >
      <div className="flex gap-3">
        <div
          className={
            threadLine ? 'flex w-12 shrink-0 flex-col items-center' : 'contents'
          }
        >
          <ProfileHoverCard userId={post.author.id}>
            <button
              onClick={(e) => handleProfileClick(e)}
              className="h-fit shrink-0"
            >
              <UserAvatar
                name={post.author.name}
                image={post.author.image}
                className="size-10"
              />
            </button>
          </ProfileHoverCard>
          <Show when={threadLine}>
            <div className="bg-border mt-1 -mb-3 w-px flex-1" />
          </Show>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1 text-sm">
            <ProfileHoverCard userId={post.author.id}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate({
                    to: '/profile/$userId',
                    params: { userId: post.author.id },
                  });
                }}
                className="flex min-w-0 items-center gap-1 font-bold hover:underline"
              >
                <span className="truncate">{post.author.name}</span>
                <Show when={post.author.emailVerified}>
                  <VerifiedBadge />
                </Show>
              </button>
            </ProfileHoverCard>
            <span className="text-muted-foreground truncate">@{handle}</span>
            <span className="text-muted-foreground">
              · {timeAgo(post.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 text-[15px] leading-normal whitespace-pre-wrap">
            <MentionText text={post.content} />
          </p>
          <Show when={post.media.length > 0}>
            <div
              className={
                post.media.length === 1
                  ? 'mt-3'
                  : 'mt-3 grid grid-cols-2 gap-1.5'
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
                    loading="lazy"
                    className="border-border max-h-105 w-full rounded-xl border object-cover"
                  />
                )}
              </For>
            </div>
          </Show>
          <Show when={post.quotedPost}>
            {(quotedPost) => (
              <QuotedPostPreview
                post={quotedPost}
                onClick={() =>
                  navigate({
                    to: '/post/$postId',
                    params: { postId: quotedPost.id },
                  })
                }
              />
            )}
          </Show>
          <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
            <DialogCreateReply
              post={post}
              trigger={
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="size-4" />
                  {formatCount(post.replyCount)}
                </button>
              }
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-1.5 transition-colors outline-none hover:text-green-500 ${
                  post.repostedByMe ? 'text-green-500' : ''
                }`}
              >
                <Repeat2 className="size-4" />
                {formatCount(post.repostCount)}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuItem
                  onClick={() => setRepost(post.id, !post.repostedByMe)}
                >
                  <Repeat2 />
                  {post.repostedByMe ? 'Undo repost' : 'Repost'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQuoteOpen(true)}>
                  <Quote />
                  Quote post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DialogCreateQuote
              post={post}
              open={quoteOpen}
              onOpenChange={setQuoteOpen}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLike(post.id, !post.likedByMe);
              }}
              className={`flex items-center gap-1.5 transition-colors hover:text-red-500 ${
                post.likedByMe ? 'text-red-500' : ''
              }`}
            >
              <Heart
                className="size-4"
                fill={post.likedByMe ? 'currentColor' : 'none'}
              />
              {formatCount(post.likeCount)}
            </button>
            <div className="flex items-center justify-between gap-2 w-[20%]">
              <button
                className={cn('hover:text-foreground transition-colors ', {
                  'text-primary': post.savedByMe,
                })}
                onClick={(e) => {
                  e.stopPropagation();
                  setSave(post.id, !post.savedByMe);
                }}
              >
                <Bookmark
                  className="size-4"
                  fill={post.savedByMe ? 'currentColor' : 'none'}
                />
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const url = `${window.location.origin}/post/${post.id}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success('Link copied to clipboard');
                  } catch {
                    toast.error('Could not copy link');
                  }
                }}
                className="hover:text-foreground transition-colors"
              >
                <Share className="size-4" />
              </button>
              <PostCardMenu post={post} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
