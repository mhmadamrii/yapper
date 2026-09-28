import { sql } from 'drizzle-orm';
import { interest } from '../schema/interest';
import type { Database } from '../index';

// Fixed catalog, curated display order (matches the interest-picker grid).
// Slugs are derived once here and never renamed — they're a stable FK target
// for `post.interestSlug` / `user_interest`.
const INTEREST_NAMES = [
  'Animals',
  'Art',
  'Books',
  'Comedy',
  'Comics',
  'Culture',
  'Software Dev',
  'Education',
  'Finance',
  'Food',
  'Video Games',
  'Journalism',
  'Movies',
  'Music',
  'Nature',
  'News',
  'Pets',
  'Photography',
  'Politics',
  'Science',
  'Sports',
  'Tech',
  'TV',
  'Writers',
] as const;

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export const INTEREST_SEED = INTEREST_NAMES.map((name, order) => ({
  slug: slugify(name),
  name,
  order,
}));

// Idempotent — safe to call on every server boot. Cheap (~24 rows), so no
// separate migration/deploy step to remember when the catalog changes.
export async function ensureInterestsSeeded(db: Database) {
  await db
    .insert(interest)
    .values(INTEREST_SEED)
    .onConflictDoUpdate({
      target: interest.slug,
      set: { name: sql`excluded.name`, order: sql`excluded."order"` },
    });
}
