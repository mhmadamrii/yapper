import { Fragment } from 'react';
import { splitMentions } from '@/lib/mentions';
import { splitUrls } from '@/lib/urls';

// Renders `@handle` and bare links in blue — inherits the parent element's
// own className (whitespace, size, truncation), so drop this in wherever
// `{post.content}` used to sit.
//
// URLs are split *inside* each non-mention run rather than in one pass, so a
// handle that appears in a link's path can't be mistaken for a mention.
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
          <Fragment key={i}>
            {splitUrls(segment.value).map((part, j) =>
              part.type === 'url' ? (
                <a
                  key={j}
                  href={part.href}
                  target="_blank"
                  // noreferrer implies noopener; both keep the opened tab from
                  // reaching back into this one via `window.opener`.
                  rel="noopener noreferrer nofollow"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-500 hover:underline"
                >
                  {part.value}
                </a>
              ) : (
                <Fragment key={j}>{part.value}</Fragment>
              ),
            )}
          </Fragment>
        ),
      )}
    </>
  );
}
