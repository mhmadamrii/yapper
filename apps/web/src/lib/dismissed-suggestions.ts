import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'yapper:dismissed-suggestions';

/**
 * Locally dismissed follow suggestions.
 *
 * An external store rather than component state because several interstitials
 * are mounted at once down the feed and every one of them has to drop a
 * candidate the moment it is dismissed anywhere — otherwise the same face
 * reappears two modules later.
 *
 * Persisted to localStorage so a dismissal survives a reload. A real platform
 * records this server-side (it is a ranking signal, not just a UI preference);
 * at portfolio scale localStorage is the honest scope.
 */
let dismissed: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();
const EMPTY: ReadonlySet<string> = new Set();

function read(): ReadonlySet<string> {
  if (dismissed) return dismissed;
  if (typeof window === 'undefined') return EMPTY;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    dismissed = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    dismissed = new Set();
  }
  return dismissed;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function dismiss(userId: string) {
  const next = new Set(read());
  next.add(userId);
  dismissed = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Private mode / quota — the in-memory set still holds for this session.
  }

  listeners.forEach((listener) => listener());
}

export function useDismissedSuggestions() {
  // The server render has no localStorage, so it must return the same empty
  // set every call or React will loop on a changing snapshot.
  const value = useSyncExternalStore(subscribe, read, () => EMPTY);

  return {
    isDismissed: useCallback((userId: string) => value.has(userId), [value]),
    dismiss,
  };
}
