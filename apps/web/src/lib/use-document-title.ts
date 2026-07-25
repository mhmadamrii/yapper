import { useEffect } from 'react';

// For routes without a loader, the real title (a user's name, a post's
// author) only exists after the client query resolves — head() can't see
// it. This patches the tab title in after the fact, same as Bluesky's own
// client-rendered profile/post pages do.
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} — Yapper`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
