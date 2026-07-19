import { authClient } from '@/lib/auth-client';
import { imageKitUrl, uploadToImageKit } from '@/lib/imagekit';
import { useTRPC } from '@/utils/trpc';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { ImageIcon, ImagePlay, Smile, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { For, Show } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { CharProgress } from './dialog-create-post';

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

const MAX_POST_LENGTH = 300;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface PendingImage {
  file: File;
  previewUrl: string;
}

// Structural subset of both `post.list` items and `post.byId` output, so
// either can be passed as the reply target.
export interface ReplyTarget {
  id: string;
  content: string;
  author: {
    name: string;
    username: string | null;
    image: string | null;
  };
  media: Array<{
    id: string;
    filePath: string;
    altText: string | null;
  }>;
}

export function DialogCreateReply({
  post,
  trigger,
}: {
  post: ReplyTarget;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadAuth = useMutation(trpc.media.uploadAuth.mutationOptions());
  const createReply = useMutation(trpc.post.create.mutationOptions());

  const remaining = MAX_POST_LENGTH - text.length;
  const canReply =
    !isPosting &&
    remaining >= 0 &&
    (text.trim().length > 0 || images.length > 0);

  const reset = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setText('');
    setImages([]);
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: PendingImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} is larger than 8MB`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setImages((prev) => {
      const merged = [...prev, ...next];
      if (merged.length > MAX_IMAGES) {
        toast.error(`Up to ${MAX_IMAGES} images per reply`);
      }
      return merged.slice(0, MAX_IMAGES);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleReply = async () => {
    setIsPosting(true);
    try {
      const media = [];
      for (const { file } of images) {
        // Each ImageKit auth token is single-use — one per file.
        const auth = await uploadAuth.mutateAsync();
        const result = await uploadToImageKit(file, auth);
        media.push({
          fileId: result.fileId,
          filePath: result.filePath,
          width: result.width,
          height: result.height,
          format:
            result.name.split('.').pop()?.toLowerCase() ??
            file.type.replace('image/', ''),
          bytes: result.size,
        });
      }

      await createReply.mutateAsync({
        content: text.trim(),
        media,
        replyToPostId: post.id,
      });
      await queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() });

      toast.success('Reply sent');
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reply');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    // The dialog is portaled to <body>, but React synthetic events still
    // bubble through the React tree — without this barrier, clicks inside
    // the dialog (backdrop, Cancel) reach ancestor onClick handlers like
    // PostCard's navigate-to-detail.
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (isPosting) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogTrigger render={trigger} />

        <DialogContent
          showCloseButton={false}
          className="gap-0 p-0 sm:max-w-xl"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <Button
              variant="ghost"
              className="text-primary text-base"
              disabled={isPosting}
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={!canReply}
              onClick={handleReply}
            >
              {isPosting ? 'Replying...' : 'Reply'}
            </Button>
          </div>

          <div className="border-border flex gap-3 border-b px-4 pb-4">
            <UserAvatar
              name={post.author.name}
              image={post.author.image}
              className="size-11 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{post.author.name}</p>
              <p className="line-clamp-3 text-[15px]">{post.content}</p>
            </div>
            <Show when={post.media[0]}>
              {(m) => (
                <img
                  src={imageKitUrl(m.filePath, 'w-200,f-auto,q-auto')}
                  alt={m.altText ?? ''}
                  className="border-border size-20 shrink-0 rounded-lg border object-cover"
                />
              )}
            </Show>
          </div>

          <div className="flex gap-3 px-4 py-4">
            <UserAvatar
              name={session?.user.name ?? 'You'}
              image={session?.user.image}
              className="size-11 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your reply"
                rows={images.length > 0 ? 3 : 6}
                className="placeholder:text-muted-foreground w-full resize-none bg-transparent pt-2 text-lg outline-none"
              />

              <Show when={images.length > 0}>
                <div className="grid grid-cols-2 gap-2">
                  <For each={images}>
                    {(img, i) => (
                      <div key={img.previewUrl} className="relative">
                        <img
                          src={img.previewUrl}
                          alt=""
                          className="border-border h-36 w-full rounded-lg border object-cover"
                        />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          <div className="border-border flex items-center justify-between border-t px-4 py-3">
            <div className="text-primary flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={images.length >= MAX_IMAGES}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="size-5" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <ImagePlay className="size-5" />
              </Button>
              <Button variant="ghost" size="icon-sm">
                <Smile className="size-5" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <button className="text-primary text-sm font-medium">
                English
              </button>
              <span
                className={
                  remaining < 0
                    ? 'text-destructive text-sm'
                    : 'text-muted-foreground text-sm'
                }
              >
                {remaining}
              </span>
              <CharProgress used={text.length} max={MAX_POST_LENGTH} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
