import { authClient } from '@/lib/auth-client';
import { mediaUrl, uploadToStorage } from '@/lib/media';
import { useTRPC } from '@/utils/trpc';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { Input } from '@yapper/ui/components/input';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { Show } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

const MAX_BIO_LENGTH = 300;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface EditableProfile {
  id: string;
  name: string;
  image: string | null;
  bio: string | null;
  bannerPath: string | null;
}

interface PendingImage {
  file: File;
  previewUrl: string;
}

function usePendingImage() {
  const [pending, setPending] = useState<PendingImage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (files: FileList | null) => {
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
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const clear = () => {
    setPending((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  return { pending, inputRef, pick, clear };
}

export function DialogEditProfile({
  profile,
  trigger,
}: {
  profile: EditableProfile;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const avatar = usePendingImage();
  const banner = usePendingImage();

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadUrl = useMutation(trpc.media.uploadUrl.mutationOptions());
  const updateProfile = useMutation(trpc.user.updateProfile.mutationOptions());

  const canSave =
    !isSaving && name.trim().length > 0 && bio.length <= MAX_BIO_LENGTH;

  const resetTo = (source: EditableProfile) => {
    setName(source.name);
    setBio(source.bio ?? '');
    avatar.clear();
    banner.clear();
  };

  const upload = async (file: File) => {
    const { uploadUrl: url, objectKey } = await uploadUrl.mutateAsync({
      contentType: file.type,
      size: file.size,
    });
    return uploadToStorage(file, url, objectKey);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let image: string | undefined;
      if (avatar.pending) {
        const result = await upload(avatar.pending.file);
        // Bare object key, resolved via mediaUrl() at render time — same
        // as bannerPath, rather than baking a transformed URL in here.
        image = result.objectKey;
      }

      let bannerPath: string | undefined;
      if (banner.pending) {
        const result = await upload(banner.pending.file);
        bannerPath = result.objectKey;
      }

      await updateProfile.mutateAsync({ bio: bio.trim(), bannerPath });

      if (name.trim() !== profile.name || image) {
        // better-auth owns name/image and re-syncs the client session.
        await authClient.updateUser({
          name: name.trim(),
          ...(image ? { image } : {}),
        });
      }

      // Author name/avatar are denormalized into every cached post.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.user.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() }),
      ]);

      toast.success('Profile updated');
      avatar.clear();
      banner.clear();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update profile',
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
        // Re-seed from the latest profile on open; drop edits on close.
        resetTo(profile);
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            className="text-primary text-base"
            disabled={isSaving}
            onClick={() => {
              resetTo(profile);
              setOpen(false);
            }}
          >
            Cancel
          </Button>
          <DialogTitle className="text-lg font-bold">Edit profile</DialogTitle>
          <Button
            variant="ghost"
            className="text-primary text-base"
            disabled={!canSave}
            onClick={handleSave}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <div className="relative">
          <Show
            when={banner.pending?.previewUrl ?? profile.bannerPath}
            fallback={
              <div className="from-primary/40 to-primary/10 h-36 bg-gradient-to-r" />
            }
          >
            {(src) => (
              <img
                src={
                  banner.pending
                    ? src
                    : mediaUrl(src, {
                        width: 1200,
                        height: 400,
                        gravity: 'sm',
                      })
                }
                alt="Banner"
                className="h-36 w-full object-cover"
              />
            )}
          </Show>
          <input
            ref={banner.inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              banner.pick(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute right-3 bottom-3 rounded-full bg-black/60 text-white hover:bg-black/80"
            disabled={isSaving}
            onClick={() => banner.inputRef.current?.click()}
          >
            <Camera className="size-4" />
          </Button>

          <div className="absolute bottom-0 left-4 w-fit translate-y-1/2">
            <Show
              when={avatar.pending}
              fallback={
                <UserAvatar
                  name={profile.name}
                  image={profile.image}
                  className="border-background size-20 border-4"
                />
              }
            >
              {(img) => (
                <img
                  src={img.previewUrl}
                  alt="Avatar preview"
                  className="border-background size-20 rounded-full border-4 object-cover"
                />
              )}
            </Show>
            <input
              ref={avatar.inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                avatar.pick(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              size="icon-sm"
              className="absolute -right-1 -bottom-1 size-7 rounded-full bg-black/60 text-white hover:bg-black/80"
              disabled={isSaving}
              onClick={() => avatar.inputRef.current?.click()}
            >
              <Camera className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 pt-14 pb-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">Display name</span>
            <Input
              value={name}
              maxLength={100}
              disabled={isSaving}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">Description</span>
            <textarea
              value={bio}
              rows={4}
              disabled={isSaving}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself"
              className="border-input placeholder:text-muted-foreground w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <span
              className={
                bio.length > MAX_BIO_LENGTH
                  ? 'text-destructive self-end text-xs'
                  : 'text-muted-foreground self-end text-xs'
              }
            >
              {MAX_BIO_LENGTH - bio.length}
            </span>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
