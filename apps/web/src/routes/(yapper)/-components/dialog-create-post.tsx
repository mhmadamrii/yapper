import { authClient } from '@/lib/auth-client';
import { uploadToImageKit } from '@/lib/imagekit';
import { useTRPC } from '@/utils/trpc';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import {
  ChevronDown,
  Globe,
  ImageIcon,
  ImagePlay,
  Smile,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

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

export function DialogCreatePost({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadAuth = useMutation(trpc.media.uploadAuth.mutationOptions());
  const createPost = useMutation(trpc.post.create.mutationOptions());

  const remaining = MAX_POST_LENGTH - text.length;
  const canPost =
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

  const handlePost = async () => {
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

      await createPost.mutateAsync({ content: text.trim(), media });
      await queryClient.invalidateQueries({
        queryKey: trpc.post.list.infiniteQueryKey(),
      });

      toast.success('Post created');
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPosting) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-xl">
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
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-primary text-base">
              Drafts
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={!canPost}
              onClick={handlePost}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>

        <div className="flex gap-3 px-4 pb-4">
          <img
            src={session?.user.image ?? '/prabowo.jpg'}
            alt={session?.user.name ?? 'You'}
            className="size-11 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's up?"
              rows={images.length > 0 ? 4 : 8}
              className="placeholder:text-muted-foreground w-full resize-none bg-transparent pt-2 text-lg outline-none"
            />

            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {images.map((img, i) => (
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
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-3">
          <button className="bg-secondary text-secondary-foreground hover:bg-accent flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors">
            <Globe className="size-4" />
            Anyone can interact
            <ChevronDown className="size-4" />
          </button>
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
  );
}

function CharProgress({ used, max }: { used: number; max: number }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(used / max, 1);
  const over = used > max;

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        strokeWidth="3"
        className="stroke-border"
      />
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        strokeLinecap="round"
        className={over ? 'stroke-destructive' : 'stroke-primary'}
      />
    </svg>
  );
}
