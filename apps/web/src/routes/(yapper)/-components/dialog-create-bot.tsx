import { uploadToStorage } from '@/lib/media';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 2000;
const MIN_INTERVAL_MINUTES = 60;

export interface EditableBot {
  userId: string;
  name: string;
  username: string | null;
  image: string | null;
  systemPrompt: string;
  postIntervalMinutes: number;
}

// Same trigger-button → hidden-file-input → preview pattern as
// `dialog-edit-profile.tsx`'s `usePendingImage` — duplicated locally rather
// than shared, since it's small and this dialog's create/edit branching
// already makes it not a drop-in match.
function usePendingImage() {
  const [pending, setPending] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
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

export function DialogCreateBot({
  trigger,
  bot,
}: {
  trigger: React.ReactElement;
  bot?: EditableBot;
}) {
  const isEdit = !!bot;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(bot?.name ?? '');
  const [username, setUsername] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(bot?.systemPrompt ?? '');
  const [intervalMinutes, setIntervalMinutes] = useState(
    bot?.postIntervalMinutes ?? MIN_INTERVAL_MINUTES,
  );
  const [isSaving, setIsSaving] = useState(false);
  const avatar = usePendingImage();

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadUrl = useMutation(trpc.media.uploadUrl.mutationOptions());
  const createBot = useMutation(trpc.bot.create.mutationOptions());
  const updateBot = useMutation(trpc.bot.update.mutationOptions());

  const reset = () => {
    setPassword('');
    setName(bot?.name ?? '');
    setUsername('');
    setSystemPrompt(bot?.systemPrompt ?? '');
    setIntervalMinutes(bot?.postIntervalMinutes ?? MIN_INTERVAL_MINUTES);
    avatar.clear();
  };

  const canSave =
    !isSaving &&
    name.trim().length > 0 &&
    systemPrompt.trim().length > 0 &&
    systemPrompt.length <= MAX_PROMPT_LENGTH &&
    intervalMinutes >= MIN_INTERVAL_MINUTES &&
    (isEdit || (password.length > 0 && username.trim().length >= 3));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let avatarObjectKey: string | undefined;
      if (avatar.pending) {
        const { uploadUrl: url, objectKey } = await uploadUrl.mutateAsync({
          contentType: avatar.pending.file.type,
          size: avatar.pending.file.size,
        });
        const result = await uploadToStorage(
          avatar.pending.file,
          url,
          objectKey,
        );
        avatarObjectKey = result.objectKey;
      }

      if (isEdit) {
        await updateBot.mutateAsync({
          userId: bot.userId,
          name: name.trim(),
          systemPrompt: systemPrompt.trim(),
          postIntervalMinutes: intervalMinutes,
          ...(avatarObjectKey ? { avatarObjectKey } : {}),
        });
        toast.success('Bot updated');
      } else {
        await createBot.mutateAsync({
          password,
          name: name.trim(),
          username: username.trim(),
          systemPrompt: systemPrompt.trim(),
          postIntervalMinutes: intervalMinutes,
          ...(avatarObjectKey ? { avatarObjectKey } : {}),
        });
        toast.success('Bot created');
      }

      await queryClient.invalidateQueries({
        queryKey: trpc.bot.list.queryKey(),
      });
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save bot',
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
          <DialogTitle>{isEdit ? 'Edit bot' : 'Create bot'}</DialogTitle>
          <Show when={!isEdit}>
            <DialogDescription>
              Gated by a temporary shared password — not real access control.
              Any account with the password can create up to 3 bots.
            </DialogDescription>
          </Show>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Show
              when={avatar.pending}
              fallback={
                <UserAvatar
                  name={name || 'Bot'}
                  image={bot?.image ?? null}
                  className="size-14 shrink-0"
                />
              }
            >
              {(img) => (
                <img
                  src={img.previewUrl}
                  alt="Avatar preview"
                  className="size-14 shrink-0 rounded-full object-cover"
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
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => avatar.inputRef.current?.click()}
            >
              <Camera className="size-4" />
              Change avatar
            </Button>
          </div>

          <Show when={!isEdit}>
            <label className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-sm">
                Creation password
              </span>
              <Input
                type="password"
                value={password}
                disabled={isSaving}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </Show>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">Name</span>
            <Input
              value={name}
              maxLength={100}
              disabled={isSaving}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bot's display name"
            />
          </label>

          <Show
            when={!isEdit}
            fallback={
              <p className="text-muted-foreground text-sm">
                @{bot?.username ?? 'unknown'} — handles can't be changed after
                creation.
              </p>
            }
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-sm">Username</span>
              <div className="flex items-center gap-1">
                <Input
                  value={username}
                  disabled={isSaving}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="somebot"
                />
                <span className="text-muted-foreground text-sm">.yapper</span>
              </div>
            </label>
          </Show>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">System prompt</span>
            <textarea
              value={systemPrompt}
              rows={5}
              disabled={isSaving}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a sarcastic sports commentator who..."
              className="border-input placeholder:text-muted-foreground w-full resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <span className="text-muted-foreground self-end text-xs">
              {MAX_PROMPT_LENGTH - systemPrompt.length}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-sm">
              Post every (minutes)
            </span>
            <Input
              type="number"
              min={MIN_INTERVAL_MINUTES}
              value={intervalMinutes}
              disabled={isSaving}
              onChange={(e) => setIntervalMinutes(Number(e.target.value) || 0)}
            />
            <Show when={intervalMinutes < MIN_INTERVAL_MINUTES}>
              <span className="text-destructive text-xs">
                Minimum {MIN_INTERVAL_MINUTES} minutes
              </span>
            </Show>
          </label>
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
            {isSaving ? 'Saving...' : isEdit ? 'Save' : 'Create bot'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
