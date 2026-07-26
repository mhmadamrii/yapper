export interface MentionSegment {
  type: 'text' | 'mention';
  value: string;
}

// Mentions start at the beginning of the string or after whitespace — same
// trigger rule as the composer's autocomplete (mention-textarea.tsx).
const MENTION_PATTERN = /(^|\s)@([a-zA-Z0-9_]{1,30})/g;

export function splitMentions(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_PATTERN.lastIndex = 0;
  while ((match = MENTION_PATTERN.exec(text))) {
    const [, prefix, handle] = match;
    const start = match.index + prefix.length;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    segments.push({ type: 'mention', value: `@${handle}` });
    lastIndex = start + 1 + handle.length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}
