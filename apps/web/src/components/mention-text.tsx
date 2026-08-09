import { Fragment } from 'react';
import { splitMentions } from '@/lib/mentions';

// Renders `@handle` runs in blue — inherits the parent element's own
// className (whitespace, size, truncation), so drop this in wherever
// `{post.content}` used to sit.
export function MentionText({ text }: { text: string }) {
  const segments = splitMentions(text);
  return (
    <>
      {segments.map((segment, i) =>
        segment.type === 'mention' ? (
          <span key={i} className="text-blue-500">
            {segment.value}
          </span>
        ) : (
          <Fragment key={i}>{segment.value}</Fragment>
        ),
      )}
    </>
  );
}
