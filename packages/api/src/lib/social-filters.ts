import { eq, or } from 'drizzle-orm';
import { createDb } from '@yapper/db';
import { block, mute } from '@yapper/db/schema/social';

export type ViewerExclusions = {
  // Either direction blocked — used for hard gates (profile/post 404, follow/reply refusal).
  blocked: Set<string>;
  // blocked ∪ muted — used for soft filtering (feed, reply lists).
  feedExcluded: Set<string>;
};

export async function getViewerExclusions(
  db: ReturnType<typeof createDb>,
  viewerId: string | undefined,
): Promise<ViewerExclusions> {
  if (!viewerId) {
    return { blocked: new Set(), feedExcluded: new Set() };
  }

  const [blockRows, muteRows] = await Promise.all([
    db
      .select({ blockerId: block.blockerId, blockedId: block.blockedId })
      .from(block)
      .where(or(eq(block.blockerId, viewerId), eq(block.blockedId, viewerId))),
    db
      .select({ mutedId: mute.mutedId })
      .from(mute)
      .where(eq(mute.muterId, viewerId)),
  ]);

  const blocked = new Set(
    blockRows.map((row) =>
      row.blockerId === viewerId ? row.blockedId : row.blockerId,
    ),
  );
  const feedExcluded = new Set([
    ...blocked,
    ...muteRows.map((row) => row.mutedId),
  ]);

  return { blocked, feedExcluded };
}
