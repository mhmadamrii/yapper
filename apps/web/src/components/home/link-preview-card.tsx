import { Globe, X } from 'lucide-react';
import { Show } from '@/components/control-flow';
import { withScheme } from '@/lib/urls';

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string;
}

/**
 * The unfurled link card.
 *
 * `onDismiss` turns it into the composer's removable variant; without it the
 * card is the read-only one rendered inside a post.
 */
export function LinkPreviewCard({
  preview,
  onDismiss,
}: {
  preview: LinkPreviewData;
  onDismiss?: () => void;
}) {
  const body = (
    <>
      <Show when={preview.imageUrl}>
        {(imageUrl) => (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            // A broken og:image should collapse to a text-only card rather
            // than leaving the browser's torn-image glyph in the layout.
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
            className="border-border max-h-80 w-full border-b object-cover"
          />
        )}
      </Show>

      <div className="space-y-1 p-3">
        <Show when={preview.title}>
          {(title) => <p className="line-clamp-2 font-semibold">{title}</p>}
        </Show>
        <Show when={preview.description}>
          {(description) => (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {description}
            </p>
          )}
        </Show>
        <p className="text-muted-foreground border-border flex items-center gap-1.5 border-t pt-2 text-xs">
          <Globe className="size-3.5 shrink-0" />
          <span className="truncate">{preview.domain}</span>
        </p>
      </div>
    </>
  );

  return (
    <div className="border-border relative mt-3 overflow-hidden rounded-xl border">
      <Show when={onDismiss}>
        {(dismiss) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            aria-label="Remove link preview"
            className="bg-background/80 hover:bg-accent absolute top-2 right-2 rounded-full p-1.5 backdrop-blur transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </Show>

      <Show
        when={!onDismiss}
        // In the composer the card is not a link — clicking it there would
        // navigate away mid-compose.
        fallback={body}
      >
        <a
          href={withScheme(preview.url)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={(e) => e.stopPropagation()}
          className="hover:bg-accent/30 block transition-colors"
        >
          {body}
        </a>
      </Show>
    </div>
  );
}
