import { and, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { createDb } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { follow, userStats } from '@yapper/db/schema/social';

import { getViewerExclusions } from './social-filters';

type Db = ReturnType<typeof createDb>;

// Below this many follows the friend-of-friend graph is too sparse to say
// anything useful, so we fall back to global popularity (cold start).
export const MIN_FOLLOWEES_FOR_FOF = 3;

export const DEFAULT_RECOMMENDATION_LIMIT = 20;

// Hard ceiling on how many of the viewer's follows we expand. A user following
// 10k accounts would otherwise produce a 2-hop join over millions of edges.
const MAX_EXPANDED_FOLLOWEES = 500;

export type FollowRecommendation = {
  user: {
    id: string;
    name: string;
    username: string | null;
    displayUsername: string | null;
    image: string | null;
  };
  /**
   * Adamic-Adar score for `fof` results, 0 for `popular` fallback results.
   */
  score: number;
  /**
   * Raw common-neighbour count: how many accounts the viewer follows also
   * follow this candidate. 0 for `popular` fallback results.
   */
  mutualCount: number;
  reason: 'fof' | 'popular';
};

const userColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  displayUsername: user.displayUsername,
  image: user.image,
};

/**
 * Adamic-Adar: each shared intermediary contributes 1 / ln(degree) rather than
 * a flat 1, so a mutual follow from someone who follows 20 accounts counts for
 * far more than one from someone who follows 20,000.
 *
 * We weight by the intermediary's *following* count (out-degree), not their
 * follower count: the edge this join actually traverses is z -> candidate, so
 * the relevant question is "how selective is z?", not "how famous is z?".
 * Indiscriminate followers are the noise source that makes raw common-neighbour
 * counts over-recommend celebrities; this damps them directly.
 *
 * `+ e` guards both ln(0) (undefined) and ln(1) (zero, i.e. divide-by-zero) for
 * intermediaries with no user_stats row yet.
 */
const adamicAdarScore = sql<number>`
  sum(1.0 / ln(coalesce(${userStats.followingCount}, 0) + 2.718281828))::double precision
`;

/**
 * "People you might know" — triadic closure over the directed follow graph.
 *
 * Candidates are the followees-of-followees of `viewerId`, scored by weighted
 * overlap and filtered against the viewer's own follows, blocks and mutes.
 *
 * TODO(scale): this 2-hop join runs synchronously per request. It explodes for
 * users who follow accounts with millions of followers — each such followee
 * contributes its entire outbound edge set to the intermediate result, and
 * MAX_EXPANDED_FOLLOWEES only bounds the first hop, not the second. The real
 * fix is a precomputed `follow_recommendation` table (viewer_id, candidate_id,
 * score, computed_at) populated by a batch job that walks the graph offline and
 * refreshes on a cadence, with this query kept only as the cold-start path for
 * users the batch job has not covered yet. Not built yet.
 */
export async function getFollowRecommendations(
  db: Db,
  viewerId: string,
  limit: number = DEFAULT_RECOMMENDATION_LIMIT,
): Promise<FollowRecommendation[]> {
  const [followeeRows, exclusions] = await Promise.all([
    db
      .select({ id: follow.followeeId })
      .from(follow)
      .where(eq(follow.followerId, viewerId))
      .limit(MAX_EXPANDED_FOLLOWEES),
    getViewerExclusions(db, viewerId),
  ]);

  const followeeIds = followeeRows.map((row) => row.id);

  // Never recommend the viewer, anyone they already follow, anyone either side
  // of a block, or anyone they have muted.
  const excludedIds = [
    viewerId,
    ...followeeIds,
    ...exclusions.feedExcluded,
  ].filter((id, index, all) => all.indexOf(id) === index);

  if (followeeIds.length < MIN_FOLLOWEES_FOR_FOF) {
    return popularFallback(db, excludedIds, limit);
  }

  const rows = await db
    .select({
      ...userColumns,
      score: adamicAdarScore,
      mutualCount: sql<number>`count(*)::int`,
    })
    .from(follow)
    // follow.followerId here is the intermediary z: someone the viewer follows.
    .innerJoin(user, eq(user.id, follow.followeeId))
    .leftJoin(userStats, eq(userStats.userId, follow.followerId))
    .where(
      and(
        inArray(follow.followerId, followeeIds),
        notInArray(follow.followeeId, excludedIds),
      ),
    )
    // Grouping by the user PK lets Postgres carry the other user columns along.
    .groupBy(user.id)
    .orderBy(desc(adamicAdarScore), desc(sql`count(*)`))
    .limit(limit);

  if (rows.length === 0) {
    // Everyone the viewer's follows follow is already followed/blocked/muted.
    return popularFallback(db, excludedIds, limit);
  }

  return rows.map((row) => ({
    user: {
      id: row.id,
      name: row.name,
      username: row.username,
      displayUsername: row.displayUsername,
      image: row.image,
    },
    score: Number(row.score),
    mutualCount: Number(row.mutualCount),
    reason: 'fof' as const,
  }));
}

/**
 * Cold start: no usable graph signal, so rank by global follower count. Scores
 * are reported as 0 because they are not comparable to Adamic-Adar scores —
 * clients should key off `reason` instead.
 */
async function popularFallback(
  db: Db,
  excludedIds: string[],
  limit: number,
): Promise<FollowRecommendation[]> {
  const rows = await db
    .select(userColumns)
    .from(userStats)
    .innerJoin(user, eq(user.id, userStats.userId))
    .where(notInArray(user.id, excludedIds))
    .orderBy(desc(userStats.followerCount), desc(user.id))
    .limit(limit);

  return rows.map((row) => ({
    user: {
      id: row.id,
      name: row.name,
      username: row.username,
      displayUsername: row.displayUsername,
      image: row.image,
    },
    score: 0,
    mutualCount: 0,
    reason: 'popular' as const,
  }));
}
