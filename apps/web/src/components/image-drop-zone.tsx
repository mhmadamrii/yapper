import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Show } from '@/components/control-flow';
import { useSession } from '@/hooks/use-session';
import { toast } from '@/lib/toast';
import {
  DialogCreatePost,
  MAX_IMAGE_BYTES,
  MAX_IMAGES,
} from '@/routes/(yapper)/-components/dialog-create-post';

// Only file drags — dragging selected text or an in-page image carries no
// 'Files' entry, and must not trigger the overlay.
const hasFiles = (e: DragEvent) =>
  e.dataTransfer?.types.includes('Files') ?? false;

function pickImages(files: FileList | null) {
  const accepted: File[] = [];
  for (const file of Array.from(files ?? [])) {
    if (!file.type.startsWith('image/')) {
      toast.error(`${file.name} is not an image`);
    } else if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`${file.name} is larger than 8MB`);
    } else {
      accepted.push(file);
    }
  }
  if (accepted.length > MAX_IMAGES) {
    toast.error(`Up to ${MAX_IMAGES} images per post`);
  }
  return accepted.slice(0, MAX_IMAGES);
}

/**
 * App-wide drop target: drag image files anywhere over the window to get a
 * full-screen overlay, drop to open the post composer with them attached.
 * Listeners live on `window` so no individual page has to opt in, and the
 * overlay is pointer-events-none so it can't swallow the drop itself.
 */
export function ImageDropZone() {
  const { data: session } = useSession();
  const [dragging, setDragging] = useState(false);
  const [drop, setDrop] = useState<{ id: number; files: File[] } | null>(null);
  const signedIn = !!session;

  useEffect(() => {
    if (!signedIn) return;

    // dragenter/dragleave fire for every child element crossed; the counter
    // is what tells "left the window" from "moved onto another element".
    let depth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // Required for the drop event to fire, and stops the browser from
      // navigating to the dropped file.
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = pickImages(e.dataTransfer?.files ?? null);
      if (files.length > 0) setDrop({ id: Date.now(), files });
    };
    const reset = () => {
      depth = 0;
      setDragging(false);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', reset);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', reset);
    };
  }, [signedIn]);

  return (
    <>
      <Show when={dragging}>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] p-3"
        >
          <div className="border-primary bg-primary/5 flex size-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed backdrop-blur-[2px]">
            <ImagePlus className="text-primary size-12" />
            <p className="text-lg font-bold">Drop images to post</p>
            <p className="text-muted-foreground text-sm">
              Up to {MAX_IMAGES} images, 8MB each
            </p>
          </div>
        </div>
      </Show>

      <Show when={drop}>
        {(d) => (
          // Keyed per drop so each one mounts a fresh composer with its own
          // files, instead of reusing the previous drop's state.
          <DialogCreatePost
            key={d.id}
            open
            initialFiles={d.files}
            onOpenChange={(next) => {
              if (!next) setDrop(null);
            }}
          />
        )}
      </Show>
    </>
  );
}
