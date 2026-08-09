import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { firstUrl } from '@/lib/urls';
import { useTRPC } from '@/utils/trpc';

/** Typing pause before the server is asked to unfurl. */
const DEBOUNCE_MS = 600;

/**
 * Drives the composer's link card: watches the draft text, unfurls the first
 * URL once typing settles, and remembers which URLs the user dismissed.
 *
 * The debounce matters more than usual here — each miss makes the server
 * fetch a third-party page, so firing per keystroke would turn one pasted
 * link into a dozen outbound requests.
 */
export function useComposerLinkPreview(text: string) {
  const trpc = useTRPC();
  const [debouncedText, setDebouncedText] = useState(text);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedText(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const url = firstUrl(debouncedText);
  // A dismissed link stays dismissed while the user keeps editing around it;
  // re-showing the card they just closed on the next keystroke is the whole
  // failure mode this guards against.
  const active = url && !dismissed.includes(url) ? url : null;

  const { data, isFetching } = useQuery(
    trpc.link.preview.queryOptions(
      { url: active ?? '' },
      {
        enabled: !!active,
        // Unfurls are cached server-side anyway; this stops a remount or a
        // refocus from replaying the request.
        staleTime: 10 * 60 * 1000,
        retry: false,
      },
    ),
  );

  return {
    preview: active && data ? data : null,
    isLoading: !!active && isFetching,
    /** Pass to `post.create` as `linkUrl`. Null once dismissed. */
    linkUrl: active && data ? active : undefined,
    dismiss: () => {
      if (active) setDismissed((prev) => [...prev, active]);
    },
    /** Clears dismissals along with the rest of the composer state. */
    reset: () => setDismissed([]),
  };
}
