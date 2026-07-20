import { useState } from 'react';
import { imageKitUrl } from '@/lib/imagekit';
import { ProfileHoverCard } from '@/components/profile-hover-card';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { useSetLike } from '@/lib/use-set-like';
import { useSetSave } from '@/lib/use-set-save';
import { useDeletePost } from '@/lib/use-delete-post';
import { authClient } from '@/lib/auth-client';
import { DialogCreateReply } from '@/routes/(yapper)/-components/dialog-create-reply';
import { formatCount, timeAgo } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import {
  Bookmark,
  Clipboard,
  Ellipsis,
  EyeOff,
  Filter,
  Flag,
  Frown,
  Heart,
  Languages,
  MessageCircle,
  Pin,
  Repeat2,
  Settings,
  Share,
  Smile,
  Trash2,
  UserX,
  VolumeX,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@yapper/ui/components/dropdown-menu';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@yapper/ui/components/dialog';
import { Button } from '@yapper/ui/components/button';

import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

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
  const setSave = useSetSave();
  const deletePost = useDeletePost();
  const { data: session } = authClient.useSession();
  const isOwnPost = session?.user.id === post.author.id;
  const handle = post.author.username ?? 'unknown';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deletePost(post.id);
      setDeleteOpen(false);
    } catch {
      // useDeletePost already surfaces a toast on error
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      onClick={() =>
        navigate({ to: '/post/$postId', params: { postId: post.id } })
      }
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
              onClick={(e) => {
                e.stopPropagation();
                navigate({
                  to: '/profile/$userId',
                  params: { userId: post.author.id },
                });
              }}
              className="h-fit shrink-0"
            >
              <UserAvatar
                name={post.author.name}
                image={post.author.image}
                className="size-10"
              />
            </button>
          </ProfileHoverCard>
          {threadLine && <div className="bg-border mt-1 -mb-3 w-px flex-1" />}
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
                {post.author.emailVerified && <VerifiedBadge />}
              </button>
            </ProfileHoverCard>
            <span className="text-muted-foreground truncate">@{handle}</span>
            <span className="text-muted-foreground">
              · {timeAgo(post.createdAt)}
            </span>
          </div>
          <p className="mt-0.5 text-[15px] leading-normal whitespace-pre-wrap">
            {post.content}
          </p>
          {post.media.length > 0 && (
            <div
              className={
                post.media.length === 1
                  ? 'mt-3'
                  : 'mt-3 grid grid-cols-2 gap-1.5'
              }
            >
              {post.media.map((m) => (
                <img
                  key={m.id}
                  src={imageKitUrl(m.filePath, 'w-1200,f-auto,q-auto')}
                  alt={m.altText ?? ''}
                  width={m.width}
                  height={m.height}
                  loading="lazy"
                  className="border-border max-h-[420px] w-full rounded-xl border object-cover"
                />
              ))}
            </div>
          )}
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
            <button className="flex items-center gap-1.5 transition-colors hover:text-green-500">
              <Repeat2 className="size-4" />
              {formatCount(post.repostCount)}
            </button>
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSave(post.id, !post.savedByMe);
                }}
                className={`hover:text-foreground transition-colors ${
                  post.savedByMe ? 'text-primary' : ''
                }`}
              >
                <Bookmark
                  className="size-4"
                  fill={post.savedByMe ? 'currentColor' : 'none'}
                />
              </button>
              <button className="hover:text-foreground transition-colors">
                <Share className="size-4" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-foreground transition-colors outline-none"
                >
                  <Ellipsis className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isOwnPost && (
                    <DropdownMenuItem>
                      <Pin /> Pin to your profile
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <Languages /> Translate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(post.content);
                      toast.success('Post text copied');
                    }}
                  >
                    <Clipboard /> Copy post text
                  </DropdownMenuItem>
                  {!isOwnPost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Smile /> Show more like this
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Frown /> Show less like this
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <VolumeX /> Mute thread
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Filter /> Mute words & tags
                  </DropdownMenuItem>
                  {!isOwnPost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <EyeOff /> Hide post for me
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <VolumeX /> Mute account
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive">
                        <UserX /> Block account
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive">
                        <Flag /> Report post
                      </DropdownMenuItem>
                    </>
                  )}
                  {isOwnPost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Settings /> Edit interaction settings
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteOpen(true)}
                      >
                        <Trash2 /> Delete post
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {isOwnPost && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Delete post?</DialogTitle>
              <DialogDescription>
                This can't be undone and it will be removed from your profile,
                the timeline, and any replies to it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
}
