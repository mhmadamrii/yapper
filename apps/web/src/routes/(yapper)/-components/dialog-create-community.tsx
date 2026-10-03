import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Input } from '@yapper/ui/components/input';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { Show } from '@/components/control-flow';
import { mediaUrl, uploadToStorage } from '@/lib/media';
import { toast } from '@/lib/toast';
import { cn } from '@yapper/ui/lib/utils';
import { useTRPC } from '@/utils/trpc';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 500;

type Visibility = 'public' | 'private';

export interface EditableCommunity {
  id: string;
  name: string;
  description: string;
  coverKey: string | null;
}

export function DialogCreateCommunity({
  trigger,
  community,
}: {
  trigger: React.ReactElement;
  community?: EditableCommunity;
}) {
  const isEdit = !!community;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(community?.name ?? '');
  const [description, setDescription] = useState(community?.description ?? '');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [cover, setCover] = useState<{ file: File; previewUrl: string } | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const uploadUrl = useMutation(trpc.media.uploadUrl.mutationOptions());
  const createCommunity = useMutation(trpc.community.create.mutationOptions());
  const updateCommunity = useMutation(trpc.community.update.mutationOptions());

  const clearCover = () =>
    setCover((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });

  const reset = () => {
    setName(community?.name ?? '');
    setDescription(community?.description ?? '');
    setVisibility('public');
    clearCover();
  };

  const pickCover = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(`${file.name} is not an image`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`${file.name} is larger than 8MB`);
      return;
    }
    setCover((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const existingCoverUrl = community?.coverKey
    ? mediaUrl(community.coverKey, { width: 800, height: 256, gravity: 'sm' })
    : null;

  const canSave =
    !isSaving &&
    name.trim().length >= 3 &&
    description.trim().length > 0 &&
    description.length <= MAX_DESCRIPTION_LENGTH;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let coverKey: string | undefined;
      if (cover) {
        const { uploadUrl: url, objectKey } = await uploadUrl.mutateAsync({
          contentType: cover.file.type,
          size: cover.file.size,
        });
        coverKey = (await uploadToStorage(cover.file, url, objectKey))
          .objectKey;
      }

      if (community) {
        await updateCommunity.mutateAsync({
          id: community.id,
          name: name.trim(),
          description: description.trim(),
          coverKey,
        });
      } else {
        const { id } = await createCommunity.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          visibility,
          coverKey,
        });
        navigate({
          to: '/communities/$communityId',
          params: { communityId: id },
        });
      }
      await queryClient.invalidateQueries({
        queryKey: trpc.community.pathKey(),
      });
      toast.success(community ? 'Community updated' : 'Community created');
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save community',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSaving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit community' : 'Create community'}
          </DialogTitle>
          <Show when={!isEdit}>
            <DialogDescription>
              Only verified accounts can create communities.
            </DialogDescription>
          </Show>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pickCover(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="bg-accent text-muted-foreground relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl"
          >
            <Show
              when={cover?.previewUrl ?? existingCoverUrl}
              fallback={
                <span className="flex items-center gap-2 text-sm">
                  <Camera className="size-4" />
                  Add cover image
                </span>
              }
            >
              {(src) => (
                <img
                  src={src}
                  alt="Cover preview"
                  className="size-full object-cover"
                />
              )}
            </Show>
          </button>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">Name</span>
            <Input
              value={name}
              maxLength={50}
              disabled={isSaving}
              onChange={(e) => setName(e.target.value)}
              placeholder="Community name"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">Description</span>
            <textarea
              value={description}
              rows={4}
              disabled={isSaving}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this community about?"
              className="border-input placeholder:text-muted-foreground w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <span className="text-muted-foreground self-end text-xs">
              {MAX_DESCRIPTION_LENGTH - description.length}
            </span>
          </label>

          <Show when={!isEdit}>
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-sm">Visibility</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['public', 'Public', 'Anyone can join'],
                    ['private', 'Private', 'Members join by request'],
                  ] as const
                ).map(([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setVisibility(value)}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      visibility === value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent/50',
                    )}
                  >
                    <p className="font-medium">{label}</p>
                    <p className="text-muted-foreground text-xs">{hint}</p>
                  </button>
                ))}
              </div>
            </div>
          </Show>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isSaving}
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            {isSaving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
