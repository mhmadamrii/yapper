import { createDb } from '@yapper/db';
import { hashtagMention, trendingTopic } from '@yapper/db/schema/trending';
import { asc, lt, sql } from 'drizzle-orm';

/**
 * Trending = velocity, not volume.
 *
 * A tag's score is its current-hour distinct-author count divided by its own
 * 23-hour baseline. That ratio is what stops a permanently-popular tag from
 * camping the list: #nba has a huge baseline, so it needs a genuinely
 * abnormal hour to score well, while a tag nobody used yesterday can spike
 * with far fewer authors. Ranking by raw count instead would give you the
 * same ten tags every day.
 *
 * Two anti-gaming properties fall out of counting DISTINCT authors rather
 * than posts:
 *  - one person posting a tag 500 times contributes exactly 1
 *  - one person can't inflate a tag from a single post either, because the
 *    write path dedupes tags within a post (see `extractHashtags`)
 */

// Noise floor. Below this many distinct authors in the last hour, a "spike"
// is two friends and a typo. LOWER THIS TO 1 for early demos — with little
// live traffic nothing clears 3 and the list renders empty.
const MIN_RECENT_AUTHORS = 2;

// Rows kept in the snapshot table. Read path serves the top 5; the extra
// headroom means you can widen the UI without touching the cron.
const TRENDING_LIMIT = 10;

// Smoothing added to the denominator. Without it a brand-new tag has a
// baseline of ~0, divides to a near-infinite score, and permanently outranks
// everything real. 2.0 means "pretend every tag already had 2 authors/hour of
// history", so a spike has to beat a small floor, not beat zero.
const BASELINE_SMOOTHING = 2.0;

// Rolling window and its split point: the last hour is "now", the 23 hours
// before it are the tag's own normal.
const BASELINE_HOURS = 23;

// Housekeeping horizon. Mentions older than this can't influence a 24h
// window, so they're pure storage cost.
const MENTION_RETENTION_DAYS = 7;

type ScoredRow = {
  hashtag: string;
  // Neon's HTTP driver returns bigint/numeric as strings — these are NOT
  // numbers until Number() is applied below.
  recent_authors: string;
  score: string;
};

/**
 * Recomputes the whole trending snapshot. Called from the Worker's
 * `scheduled` handler every 5 minutes.
 *
 * One SQL statement does all the aggregation — the alternative (pull tags,
 * loop, count per tag) would be N+1 round-trips over HTTP from a Worker.
 */
export async function computeTrending(db = createDb()) {
  console.log('compute trending runs', new Date());
  // `filter (where ...)` splits the two windows in a single pass over the
  // 24h slice of the index, so the scan happens once, not twice.
  //
  // The CTE exists because Postgres won't let ORDER BY reference an output
  // alias from inside an expression — computing `score` in an outer SELECT
  // avoids repeating the whole ratio in the ORDER BY.
  const result = await db.execute<ScoredRow>(sql`
    with windowed as (
      select
        hashtag,
        count(distinct author_id) filter (
          where created_at >= now() - interval '1 hour'
        ) as recent_authors,
        count(distinct author_id) filter (
          where created_at < now() - interval '1 hour'
        ) as prior_authors
      from hashtag_mention
      where created_at >= now() - interval '24 hours'
      group by hashtag
    )
    select
      hashtag,
      recent_authors,
      recent_authors::numeric
        / (prior_authors::numeric / ${BASELINE_HOURS} + ${BASELINE_SMOOTHING})
        as score
    from windowed
    where recent_authors >= ${MIN_RECENT_AUTHORS}
    order by score desc
    limit ${TRENDING_LIMIT}
  `);

  const top = result.rows.map((row, i) => ({
    hashtag: row.hashtag,
    rank: i + 1,
    score: Number(row.score),
    recentAuthors: Number(row.recent_authors),
  }));

  // Neon's HTTP driver has no interactive transactions, but `db.batch` ships
  // every statement in one request wrapped in a single transaction — so
  // readers never observe a half-rebuilt list (either the old snapshot or the
  // new one, never an empty middle).
  //
  // Full delete + reinsert rather than an upsert: the table is ~10 rows, and
  // a tag that fell off the list has to disappear, which a merge wouldn't do.
  const clearSnapshot = db.delete(trendingTopic);
  const purgeOldMentions = db
    .delete(hashtagMention)
    .where(
      lt(
        hashtagMention.createdAt,
        sql`now() - make_interval(days => ${MENTION_RETENTION_DAYS})`,
      ),
    );

  if (top.length === 0) {
    // Nothing cleared the floor — the list legitimately goes empty rather
    // than serving a stale spike from an hour ago.
    await db.batch([clearSnapshot, purgeOldMentions]);
    return { count: 0 };
  }

  await db.batch([
    clearSnapshot,
    db.insert(trendingTopic).values(top),
    purgeOldMentions,
  ]);

  return { count: top.length };
}

/**
 * Read path: one index-ordered scan of a ~10-row table. Wrap this in your
 * tRPC procedure — it never touches `hashtag_mention`, so its cost doesn't
 * grow with post volume.
 *
 * Returns bare lowercase tags. Rendering ('#mariners' vs 'Mariners') is the
 * frontend's call.
 */
export function getTrending(db: ReturnType<typeof createDb>, limit = 5) {
  return db
    .select({
      hashtag: trendingTopic.hashtag,
      recentAuthors: trendingTopic.recentAuthors,
    })
    .from(trendingTopic)
    .orderBy(asc(trendingTopic.rank))
    .limit(limit);
}
