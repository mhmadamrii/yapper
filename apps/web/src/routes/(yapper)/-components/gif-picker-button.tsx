import { GifPicker, Theme, type Gif } from 'gif-picker-react';
import { Klipy } from 'gif-picker-react/providers/klipy';
import 'gif-picker-react/style.css';
import { env } from '@yapper/env/web';
import { Button } from '@yapper/ui/components/button';
import { ImagePlay } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { Show } from '@/components/control-flow';

/**
 * Klipy GIF picker for the composers. A picked GIF is downloaded into a
 * `File` and handed to `onPick`, so it flows through the exact same
 * pending-image -> ImageKit upload pipeline as a picked photo.
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

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label="Add a GIF"
        onClick={() => setOpen((prev) => !prev)}
      >
        <ImagePlay className="size-5" />
      </Button>

      <Show when={open}>
        {/* Click-away backdrop — the picker floats above the composer. */}
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="absolute bottom-10 left-0 z-50 w-[calc(100vw-2rem)] max-w-[520px]">
          <GifPicker
            provider={provider}
            theme={Theme.AUTO}
            onGifClick={handleGifClick}
            width="100%"
            height={440}
          />
        </div>
      </Show>
    </div>
  );
}
