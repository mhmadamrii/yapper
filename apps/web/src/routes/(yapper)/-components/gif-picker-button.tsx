import { GifPicker, Theme, type Gif } from 'gif-picker-react';
import { Klipy } from 'gif-picker-react/providers/klipy';
import 'gif-picker-react/style.css';
import { env } from '@yapper/env/web';
import { Button } from '@yapper/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@yapper/ui/components/popover';
import { ImagePlay } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';

/**
 * Klipy GIF picker for the composers. A picked GIF is downloaded into a
 * `File` and handed to `onPick`, so it flows through the exact same
 * pending-image -> storage upload pipeline as a picked photo.
 */
export function GifPickerButton({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (image: { file: File; previewUrl: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const provider = useMemo(() => Klipy(env.VITE_KLIPY_API_KEY), []);

  const handleGifClick = async (gif: Gif) => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const res = await fetch(gif.imageUrl);
      if (!res.ok) throw new Error(`Could not download GIF (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], `tenor-${gif.id}.gif`, {
        type: blob.type || 'image/gif',
      });
      onPick({ file, previewUrl: URL.createObjectURL(file) });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add GIF');
    } finally {
      setIsFetching(false);
    }
  };

  // Portaled popover rather than an absolutely positioned child: the
  // composer dialog scrolls (overflow-y-auto), which clipped the picker's
  // top — search input included. The positioner flips/shifts to stay on
  // screen, and the height shrinks to the space actually available.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Add a GIF">
            <ImagePlay className="size-5" />
          </Button>
        }
      />
      <PopoverContent
        side="top"
        align="start"
        className="w-[calc(100vw-2rem)] max-w-[520px] overflow-hidden p-0"
        style={{ height: 'min(440px, var(--available-height))' }}
      >
        <GifPicker
          provider={provider}
          theme={Theme.AUTO}
          onGifClick={handleGifClick}
          width="100%"
          height="100%"
        />
      </PopoverContent>
    </Popover>
  );
}
