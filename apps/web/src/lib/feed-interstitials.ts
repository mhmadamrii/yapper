/**
 * Where "People you might know" gets injected into the timeline.
 *
 * The slot is a pure function of the post's index in the flattened feed, not a
 * random draw and not a page boundary:
 *
 * - Random would re-roll on every render and every background refetch, so the
 *   module would hop between positions under the user's thumb, shift layout
 *   mid-scroll, and break scroll restoration.
 * - Page boundaries look stable but are not: a page can come back short (the
 *   server filters blocks/mutes after paging), so "every page" drifts into
 *   "every 20, then every 14, then every 19" as the user scrolls.
 *
 * Index-based placement is stable for the lifetime of the list and stays
 * correct as pages append, because appending never renumbers earlier items.
 */

/** Posts shown before the first module. Early enough to be seen without a long scroll. */
export const FIRST_INTERSTITIAL_AFTER = 3;

/** Posts between subsequent modules. */
export const INTERSTITIAL_INTERVAL = 20;

/** Candidates rendered per module. */
export const INTERSTITIAL_SIZE = 3;

/**
 * True when a module should render directly *after* the post at `index`.
 * `index` is 0-based, so `index === 2` is the third post.
 */
export function isInterstitialSlot(index: number) {
  const offset = index + 1 - FIRST_INTERSTITIAL_AFTER;
  return offset >= 0 && offset % INTERSTITIAL_INTERVAL === 0;
}

/**
 * Which module this slot is (0, 1, 2, …). Used to hand each module a distinct
 * slice of the recommendation list so the same three faces don't repeat all
 * the way down the feed.
 */
export function interstitialSlotNumber(index: number) {
  return (index + 1 - FIRST_INTERSTITIAL_AFTER) / INTERSTITIAL_INTERVAL;
}
