/**
 * Matches links the way a composer has to: as the user types, mid-word, with
 * no guarantee the string is finished. Trailing punctuation is excluded so
 * "see https://example.com." doesn't capture the sentence's full stop, and a
 * bare `www.` prefix counts because people write links that way.
 */
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,!?:;)\]}]/gi;

/** Adds the scheme a `www.`-style link leaves out. */
export function withScheme(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * The URL a post's card is built from: the first one in the text, matching
 * how X and Bluesky both behave. One card per post keeps the layout
 * predictable no matter how many links the text contains.
 */
export function firstUrl(text: string): string | null {
  URL_PATTERN.lastIndex = 0;
  const match = URL_PATTERN.exec(text);
  return match ? withScheme(match[0]) : null;
}

export interface UrlSegment {
  type: 'text' | 'url';
  value: string;
  /** Present on `url` segments: the value with a scheme, for the href. */
  href?: string;
}

/** Splits text into plain and link runs, for rendering links inline. */
export function splitUrls(text: string): UrlSegment[] {
  const segments: UrlSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: text.slice(lastIndex, match.index),
      });
    }
    segments.push({
      type: 'url',
      value: match[0],
      href: withScheme(match[0]),
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}
