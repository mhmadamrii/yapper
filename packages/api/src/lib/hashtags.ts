/**
 * Hashtag extraction for the write path.
 *
 * Runs once per post, at insert time — never at read time and never in the
 * cron. `hashtag_mention` is the materialized result of this function, so the
 * trending job only ever scans an index instead of re-parsing post bodies.
 */

// `\p{L}\p{N}_` so non-Latin tags work (#日本, #café). The lookbehind rejects
// mid-word '#' (`foo#bar`, a URL fragment like `/docs#install`) and `##tag`,
// both of which are noise rather than topics.
const HASHTAG_RE = /(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_]{1,64})/gu;

// Pure numbers aren't topics — "#1", "#2026" would otherwise trend off
// unrelated posts that happen to share a number. X rejects these too.
const ALL_DIGITS_RE = /^\p{N}+$/u;

// Bounds the bulk insert. A post stuffed with 40 tags is tag-spam, and
// letting it write 40 rows hands one author 40 votes' worth of index churn.
const MAX_HASHTAGS_PER_POST = 10;

/**
 * Read-path counterpart to extraction: turns a client-supplied tag into the
 * exact form stored in `hashtag_mention`, or null if it isn't a valid tag.
 */
export function normalizeHashtag(raw: string): string | null {
  // Clients hand back whatever the link href carried — '#Mariners',
  // '%23mariners', 'Mariners'. Everything collapses to the one storage form
  // so a tag page can't miss its own rows on a casing difference.
  const tag = raw.trim().replace(/^#+/u, '').toLowerCase();
  if (!/^[\p{L}\p{N}_]{1,64}$/u.test(tag)) return null;
  return tag;
}

/**
 * Extracts hashtags from post content: lowercased, no leading '#', deduped
 * within the post.
 *
 * The dedupe is the anti-gaming part. Trending counts DISTINCT authors per
 * tag, so if "#foo #foo #foo" wrote three rows an author would still only
 * count once — but the raw mention log would be junk, and any per-tag post
 * count derived from it would be inflatable from a single post.
 */
export function extractHashtags(content: string): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(HASHTAG_RE)) {
    const tag = match[1]!.toLowerCase();
    if (ALL_DIGITS_RE.test(tag)) continue;
    tags.add(tag);
    if (tags.size >= MAX_HASHTAGS_PER_POST) break;
  }
  return [...tags];
}
