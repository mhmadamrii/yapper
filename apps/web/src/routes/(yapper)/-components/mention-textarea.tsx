import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { For, Show } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { splitMentions } from '@/lib/mentions';
import { useTRPC } from '@/utils/trpc';

interface MentionMatch {
  query: string;
  start: number;
  end: number;
}

interface CaretCoords {
  top: number;
  left: number;
  height: number;
}

// Finds the `@query` run immediately before the caret, if any — mentions
// must start at the beginning of the text or after whitespace, matching X's
// and Bluesky's trigger rule.
function findMentionMatch(text: string, caret: number): MentionMatch | null {
  const upToCaret = text.slice(0, caret);
  const match = /(?:^|\s)@([a-zA-Z0-9_]{0,30})$/.exec(upToCaret);
  if (!match) return null;
  const query = match[1] ?? '';
  return { query, start: caret - query.length - 1, end: caret };
}

// Textarea has no native API for the pixel position of a character, so we
// render an off-screen mirror with identical text metrics and read back the
// offset of a marker span placed at that character — the standard
// caret-coordinates technique.
const MIRRORED_STYLE_PROPS = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textIndent',
  'textTransform',
  'wordSpacing',
  'tabSize',
] as const;

function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): CaretCoords {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '0';
  for (const prop of MIRRORED_STYLE_PROPS) {
    mirror.style[prop] = computed[prop];
  }

  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement('span');
  marker.textContent = textarea.value.slice(position) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const coords: CaretCoords = {
    top: marker.offsetTop - textarea.scrollTop,
    left: marker.offsetLeft - textarea.scrollLeft,
    height: marker.offsetHeight,
  };
  document.body.removeChild(mirror);
  return coords;
}

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [coords, setCoords] = useState<CaretCoords | null>(null);
  const trpc = useTRPC();

  const mention = useMemo(() => findMentionMatch(value, caret), [value, caret]);

  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    setDismissed(false);
    const id = setTimeout(() => setDebouncedQuery(mention?.query ?? ''), 250);
    return () => clearTimeout(id);
  }, [mention?.start, mention?.query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  useLayoutEffect(() => {
    if (!mention || !textareaRef.current) {
      setCoords(null);
      return;
    }
    setCoords(getCaretCoordinates(textareaRef.current, mention.start));
  }, [mention?.start, value]);

  const searchQuery = useQuery(
    trpc.user.search.queryOptions(
      { query: debouncedQuery },
      { enabled: !!mention && debouncedQuery.length > 0 },
    ),
  );

  const isSearching = debouncedQuery.length > 0 && searchQuery.isLoading;
  const results =
    mention && debouncedQuery.length > 0 ? (searchQuery.data ?? []) : [];
  const showDropdown = !!mention && !dismissed && !!coords;
  const showNoResults = showDropdown && !isSearching && results.length === 0;

  const applyMention = (username: string | null) => {
    if (!mention || !username) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.end);
    const next = `${before}@${username} ${after}`;
    const nextCaret = before.length + username.length + 2;
    onChange(next);
    setCaret(nextCaret);
    setDismissed(true);
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
      textareaRef.current?.focus();
    });
  };

  const syncCaret = (e: { currentTarget: HTMLTextAreaElement }) =>
    setCaret(e.currentTarget.selectionStart);

  return (
    <div className="relative">
      {/* Highlighter overlay: the textarea's own text is made transparent
          (below) so this is the only thing the user actually sees — same
          box model as the textarea, so wrapping stays pixel-aligned. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden break-words whitespace-pre-wrap ${className ?? ''}`}
      >
        <For each={splitMentions(value)}>
          {(segment, i) =>
            segment.type === 'mention' ? (
              <span key={i} className="text-primary">
                {segment.value}
              </span>
            ) : (
              <span key={i} className="text-foreground">
                {segment.value}
              </span>
            )
          }
        </For>
      </div>

      <textarea
        ref={textareaRef}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          syncCaret(e);
        }}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        onKeyDown={(e) => {
          if (!showDropdown || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            applyMention(results[activeIndex]?.username ?? null);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDismissed(true);
          }
        }}
        onBlur={() => setDismissed(true)}
        placeholder={placeholder}
        rows={rows}
        className={`relative text-transparent caret-foreground ${className ?? ''}`}
      />

      <Show when={showDropdown && coords}>
        {(c) => (
          <div
            style={{ top: c.top + c.height + 4, left: c.left }}
            className="bg-popover border-border absolute z-50 w-72 max-w-full overflow-hidden rounded-xl border shadow-lg"
          >
            <Show when={showNoResults}>
              <p className="text-muted-foreground px-3 py-3 text-sm">
                No result
              </p>
            </Show>
            <For each={results}>
              {(person, i) => (
                <button
                  key={person.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyMention(person.username)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                    i === activeIndex
                      ? 'bg-primary/15 text-primary'
                      : 'hover:bg-accent/60'
                  }`}
                >
                  <UserAvatar
                    name={person.name}
                    image={person.image}
                    className="size-8 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {person.name}
                    </p>
                    <p
                      className={
                        i === activeIndex
                          ? 'truncate text-xs text-primary/80'
                          : 'text-muted-foreground truncate text-xs'
                      }
                    >
                      @{person.username}
                    </p>
                  </div>
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  );
}
