import { useState } from 'react';
import { toast } from 'sonner';

import { authClient } from '@/lib/auth-client';
import { useDeletePost } from '@/lib/use-delete-post';
import { Show } from '@/components/control-flow';

// Structural, not tied to one router shape — `post.list`, `post.byId`, and
// `post.byUser` all return objects wider than this, so any of them fit.
interface MenuPost {
  id: string;
  content: string;
  author: { id: string };
}

import {
  Clipboard,
  Ellipsis,
  EyeOff,
  Filter,
  Flag,
  Frown,
  Languages,
  Pin,
  Settings,
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

/**
 * Ellipsis dropdown + delete confirm dialog for a post card. Menu contents
 * flip between "own post" (pin, edit interaction settings, delete) and
 * "other user's post" (show more/less, hide, mute/block account, report)
 * based on the viewer's session — reused wherever a post is rendered
 * (timeline, profile, thread).
 */
export function PostCardMenu({ post }: { post: MenuPost }) {
  const { data: session } = authClient.useSession();
  const deletePost = useDeletePost();
  const isOwnPost = session?.user.id === post.author.id;

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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onClick={(e) => e.stopPropagation()}
          className="hover:text-foreground transition-colors outline-none"
        >
          <Ellipsis className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="min-w-55"
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          <Show when={isOwnPost}>
            <DropdownMenuItem>
              <Pin /> Pin to your profile
            </DropdownMenuItem>
          </Show>
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
          <Show when={!isOwnPost}>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Smile /> Show more like this
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Frown /> Show less like this
            </DropdownMenuItem>
          </Show>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <VolumeX /> Mute thread
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Filter /> Mute words & tags
          </DropdownMenuItem>
          <Show when={!isOwnPost}>
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
          </Show>
          <Show when={isOwnPost}>
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
          </Show>
        </DropdownMenuContent>
      </DropdownMenu>

      <Show when={isOwnPost}>
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
      </Show>
    </>
  );
}
