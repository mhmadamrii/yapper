import { authClient } from '@/lib/auth-client';
import { CharProgress, type DraftMediaItem } from './dialog-create-post';
import { Dialog, DialogContent } from '@yapper/ui/components/dialog';
import { uploadToImageKit } from '@/lib/imagekit';
import { useTRPC } from '@/utils/trpc';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { ImageIcon, Smile, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { For, Show } from '@/components/control-flow';
import { GifPickerButton } from './gif-picker-button';
import { UserAvatar } from '@/components/user-avatar';
import {
  QuotedPostPreview,
  type QuotedPostTarget,
} from '@/components/home/quoted-post-preview';

const MAX_POST_LENGTH = 300;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface PendingImage {
  file: File;
  previewUrl: string;
}

// Controlled (no built-in trigger) — opened from a DropdownMenuItem, which
// needs the dialog rendered as a sibling rather than nested inside the
// menu (same pattern as the delete-confirm dialog in PostCardMenu).
export function DialogCreateQuote({
  post,
  open,
  onOpenChange,
}: {
  post: QuotedPostTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadAuth = useMutation(trpc.media.uploadAuth.mutationOptions());
  const createQuote = useMutation(trpc.post.create.mutationOptions());

  const remaining = MAX_POST_LENGTH - text.length;
  const canSubmit = !isPosting && remaining >= 0;

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
        toast.error(`Up to ${MAX_IMAGES} images per post`);
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

  const uploadPendingImages = async () => {
    const uploaded: DraftMediaItem[] = [];
    for (const { file } of images) {
      // Each ImageKit auth token is single-use — one per file.
      const auth = await uploadAuth.mutateAsync();
      const result = await uploadToImageKit(file, auth);
      uploaded.push({
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
    return uploaded;
  };

  const handleQuote = async () => {
    setIsPosting(true);
    try {
      const media = await uploadPendingImages();
      await createQuote.mutateAsync({
        content: text.trim(),
        media,
        quotedPostId: post.id,
      });
      await queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() });

      toast.success('Post created');
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post');
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
          onOpenChange(next);
          if (!next) reset();
        }}
      >
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
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={!canSubmit}
              onClick={handleQuote}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </Button>
          </div>

          <div className="flex gap-3 px-4 pb-4">
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
                placeholder="Add a comment"
                rows={4}
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

              <QuotedPostPreview post={post} />
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
              <GifPickerButton
                disabled={images.length >= MAX_IMAGES}
                onPick={(image) =>
                  setImages((prev) =>
                    prev.length >= MAX_IMAGES ? prev : [...prev, image],
                  )
                }
              />
              <Button variant="ghost" size="icon-sm">
                <Smile className="size-5" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
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
