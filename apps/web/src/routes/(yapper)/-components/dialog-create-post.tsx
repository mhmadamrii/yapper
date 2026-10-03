import { useSession } from '@/hooks/use-session';
import { cn } from '@yapper/ui/lib/utils';
import { mediaUrl, uploadToStorage } from '@/lib/media';
import { UserAvatar } from '@/components/user-avatar';
import { useTRPC } from '@/utils/trpc';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { ChevronDown, Hash, ImageIcon, Smile, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { For, Show } from '@/components/control-flow';
import { LinkPreviewCard } from '@/components/home/link-preview-card';
import { useComposerLinkPreview } from '@/hooks/use-composer-link-preview';
import { GifPickerButton } from './gif-picker-button';
import { MentionTextarea } from './mention-textarea';

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@yapper/ui/components/dropdown-menu';

const MAX_POST_LENGTH = 500;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

interface PendingImage {
  file: File;
  previewUrl: string;
}

export interface DraftMediaItem {
  fileId: string;
  filePath: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  altText?: string;
}

export interface InitialDraft {
  id: string;
  content: string;
  media: DraftMediaItem[];
  interestSlug?: string | null;
}

export function DialogCreatePost({
  trigger,
  initialDraft,
  communityId,
}: {
  trigger: React.ReactElement;
  initialDraft?: InitialDraft;
  // Posts into this community instead of the global timeline.
  communityId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialDraft?.content ?? '');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [existingMedia, setExistingMedia] = useState<DraftMediaItem[]>(
    initialDraft?.media ?? [],
  );
  const [selectedInterest, setSelectedInterest] = useState<string | null>(
    initialDraft?.interestSlug ?? null,
  );
  const [isPosting, setIsPosting] = useState(false);
  const linkPreview = useComposerLinkPreview(text);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadUrl = useMutation(trpc.media.uploadUrl.mutationOptions());
  const createPost = useMutation(trpc.post.create.mutationOptions());
  const createDraft = useMutation(trpc.draft.create.mutationOptions());
  const updateDraft = useMutation(trpc.draft.update.mutationOptions());
  const deleteDraft = useMutation(trpc.draft.delete.mutationOptions());

  const interestListQuery = useQuery(trpc.interest.list.queryOptions());
  const myInterestsQuery = useQuery(
    trpc.interest.mine.queryOptions(undefined, { enabled: !!session }),
  );
  // Viewer's saved interests float to the top of the picker — the rest stay
  // in the catalog's curated order.
  const interestOptions = useMemo(() => {
    const all = interestListQuery.data ?? [];
    const mine = new Set(myInterestsQuery.data ?? []);
    return [...all].sort((a, b) => {
      const aMine = mine.has(a.slug) ? 0 : 1;
      const bMine = mine.has(b.slug) ? 0 : 1;
      return aMine - bMine;
    });
  }, [interestListQuery.data, myInterestsQuery.data]);
  const selectedInterestName = interestListQuery.data?.find(
    (i) => i.slug === selectedInterest,
  )?.name;

  const totalImages = images.length + existingMedia.length;
  const remaining = MAX_POST_LENGTH - text.length;
  const canSubmit = !isPosting && remaining >= 0 && (text.trim().length > 0 || totalImages > 0); // prettier-ignore

  // Restores to the last-saved state, not always blank — for an
  // edit-in-progress draft, that's the original draft content, so
  // cancel-then-reopen (dialog instance stays mounted per row) doesn't
  // show an empty composer.
  const reset = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setText(initialDraft?.content ?? '');
    setImages([]);
    setExistingMedia(initialDraft?.media ?? []);
    setSelectedInterest(initialDraft?.interestSlug ?? null);
    linkPreview.reset();
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
      const room = Math.max(0, MAX_IMAGES - existingMedia.length);
      if (merged.length > room) {
        toast.error(`Up to ${MAX_IMAGES} images per post`);
      }
      return merged.slice(0, room);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingMedia = (index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPendingImages = async () => {
    return Promise.all(
      images.map(async ({ file }) => {
        const { uploadUrl: url, objectKey } = await uploadUrl.mutateAsync({
          contentType: file.type,
          size: file.size,
        });
        const result = await uploadToStorage(file, url, objectKey);
        return {
          fileId: result.objectKey,
          filePath: result.objectKey,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.size,
        };
      }),
    );
  };

  const handlePost = async () => {
    setIsPosting(true);
    try {
      const media = [...existingMedia, ...(await uploadPendingImages())];
      await createPost.mutateAsync({
        content: text.trim(),
        media,
        // Undefined when the card was dismissed or the post carries images,
        // so what gets stored matches what the composer showed.
        linkUrl: media.length > 0 ? undefined : linkPreview.linkUrl,
        interestSlug: selectedInterest ?? undefined,
        communityId,
      });

      // Post exists now — that's the goal. Draft cleanup and cache
      // invalidation are side effects, so they run in the background instead
      // of blocking the success toast/close on them.
      if (initialDraft) {
        deleteDraft
          .mutateAsync({ id: initialDraft.id })
          .catch(() => {})
          .finally(() =>
            queryClient.invalidateQueries({
              queryKey: trpc.draft.list.queryKey(),
            }),
          );
      }
      queryClient.invalidateQueries({
        queryKey: trpc.post.list.infiniteQueryKey(),
      });
      if (communityId) {
        queryClient.invalidateQueries({
          queryKey: trpc.post.byCommunity.pathKey(),
        });
      }

      toast.success('Post created');
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to post');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsPosting(true);
    try {
      const media = [...existingMedia, ...(await uploadPendingImages())];
      if (initialDraft) {
        await updateDraft.mutateAsync({
          id: initialDraft.id,
          content: text.trim(),
          media,
          interestSlug: selectedInterest,
        });
      } else {
        await createDraft.mutateAsync({
          content: text.trim(),
          media,
          interestSlug: selectedInterest ?? undefined,
        });
      }
      await queryClient.invalidateQueries({
        queryKey: trpc.draft.list.queryKey(),
      });

      toast.success('Draft saved');
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save draft',
      );
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
      <DialogContent
        showCloseButton={false}
        className="top-8 max-h-[calc(100vh-4rem)] translate-y-0 gap-0 overflow-y-auto p-0 sm:max-w-xl"
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
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="text-primary text-base"
              disabled={!canSubmit}
              onClick={handleSaveDraft}
            >
              Save draft
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={!canSubmit}
              onClick={handlePost}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>

        <div className="flex gap-3 px-4 pb-4">
          <UserAvatar
            name={session?.user.name ?? 'You'}
            image={session?.user.image}
            className="size-11 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <MentionTextarea
              autoFocus
              value={text}
              onChange={setText}
              placeholder="What's up?"
              rows={totalImages > 0 ? 4 : 8}
              className="placeholder:text-muted-foreground w-full resize-none bg-transparent pt-2 text-lg outline-none"
            />

            <Show when={totalImages === 0 && linkPreview.preview}>
              {(preview) => (
                <LinkPreviewCard
                  preview={preview}
                  onDismiss={linkPreview.dismiss}
                />
              )}
            </Show>
            <Show when={totalImages > 0}>
              <div className="grid grid-cols-2 gap-2">
                <For each={existingMedia}>
                  {(m, i) => (
                    <div key={m.fileId} className="relative">
                      <img
                        src={mediaUrl(m.filePath, { width: 400 })}
                        alt=""
                        className="border-border h-36 w-full rounded-lg border object-cover"
                      />
                      <button
                        onClick={() => removeExistingMedia(i)}
                        className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </For>
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

        <div className="px-4 pb-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="bg-secondary text-secondary-foreground hover:bg-accent flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors" />
              }
            >
              <Hash className="size-4" />
              {selectedInterestName ?? 'General'}
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-72 w-56">
              <DropdownMenuRadioGroup
                value={selectedInterest ?? ''}
                onValueChange={(value) =>
                  setSelectedInterest(value === '' ? null : value)
                }
              >
                <DropdownMenuRadioItem value="">General</DropdownMenuRadioItem>
                <For each={interestOptions}>
                  {(option) => (
                    <DropdownMenuRadioItem
                      key={option.slug}
                      value={option.slug}
                    >
                      {option.name}
                    </DropdownMenuRadioItem>
                  )}
                </For>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
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
              disabled={totalImages >= MAX_IMAGES}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="size-5" />
            </Button>
            <GifPickerButton
              disabled={totalImages >= MAX_IMAGES}
              onPick={(image) =>
                setImages((prev) =>
                  prev.length + existingMedia.length >= MAX_IMAGES
                    ? prev
                    : [...prev, image],
                )
              }
            />
            <Button variant="ghost" size="icon-sm">
              <Smile className="size-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-primary text-sm font-medium">
              English
            </button>
            <span
              className={cn('text-muted-foreground text-sm', {
                'text-destructive text-sm': remaining < 0,
              })}
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

export function CharProgress({ used, max }: { used: number; max: number }) {
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
