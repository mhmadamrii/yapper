# API latency investigation — 2026-08-19

Symptom: some endpoints take 1.5-4.5s for simple queries. Suspected Neon
cold starts / connection overhead. This pass was instrumentation + reading
real `wrangler tail` output — no behavior changes made.

## Stack facts checked first (both already correct, ruled out)

- **Driver**: `@neondatabase/serverless` (`neon()` HTTP driver), not raw `pg`/TCP.
  Confirmed in `packages/db/src/index.ts`.
- **`DATABASE_URL`**: already points at the Neon `-pooler` endpoint.
- **N+1 / sequential queries**: checked `notification.unreadCount`,
  `message.unreadCount`, `recommendation.follows` → `getFollowRecommendations`
  → `getViewerExclusions`. All single queries or already `Promise.all`'d.
  No N+1 found.

## Instrumentation added

- `packages/api/src/lib/debug-timing.ts` — `TIMING_LOGS_ENABLED` toggle +
  `logDbTiming(label, startedAt)`, logs `[DB] <label> <ms>ms start=<epoch>
  end=<epoch>`.
- `apps/server/src/index.ts` — `REQUEST_TIMING_ENABLED` toggle, Hono
  middleware logging `[REQ] <method> <path> received start=<epoch>` and
  `[REQ] <method> <path> → <status> <ms>ms start=<epoch> end=<epoch>`.
- Wrapped DB calls in `notification.unreadCount`, `message.unreadCount`,
  `recommendation.follows` with start/end timestamps via `logDbTiming`.

Both toggles are still `true` in the code — flip to `false` to silence once
this investigation is done.

## Findings from real `wrangler tail` output

**1. Neon cold start confirmed, and it's real.** Same-shape queries dropped
~3x once warm within a session:
- `notification.unreadCount`: 726ms (first hit) → 257ms → 252ms
- `message.unreadCount`: 767ms → 258ms → 773ms (noisy, see below)

Free-tier compute auto-suspends after idle; first query after a gap pays a
resume tax.

**2. Even warm, ~250-260ms per simple `count(*)` query is still real
overhead** — likely per-query HTTP/TLS cost inherent to the stateless
`neon-http` driver (no persistent connection reuse across calls) plus
physical distance between the Worker's execution region and the Neon
project's region. Not yet root-caused; worth checking the two regions match.

**3. `recommendation.follows` is genuinely slow, not just cold-start.**
1012ms → 1521ms → 499ms — no consistent "warms up" trend like the other two.
This is real query cost from the 2-hop Adamic-Adar join, already flagged as
a known scale issue in `packages/api/src/lib/follow-recommendations.ts:114`
(`TODO(scale)`: precompute via a batch job instead of per-request join).

**4. tRPC batch concurrency verified — procedures run in parallel, not
serialized.** Initially misread as additive from totals, but a later
`wrangler tail` capture showed two procedures in the same batch with the
*identical* `start=` epoch:
```
[DB] notification.unreadCount 252ms start=1787114682387 end=1787114682639
[DB] message.unreadCount      773ms start=1787114682387 end=1787114683160
```
Confirmed concurrent. Earlier "looks additive" read was a coincidence of
totals, not real serialization — retracted.

**5. Biggest single finding: a large gap between "request received" and the
first DB query actually starting** — bigger than the DB queries themselves
in some cases:

| Request | received | first DB `start` | gap |
|---|---|---|---|
| batch (notification/message/trending) | 1787114681349 | 1787114682387 | **1038ms** |
| `recommendation.follows` | 1787114684141 | 1787114684628 | **487ms** |

This gap sits *before* any procedure body runs, which points at tRPC context
creation. Checked `packages/api/src/context.ts:8-9`:
```ts
export async function createContext({ context }: CreateContextOptions) {
  const session = await createAuth().api.getSession({ headers: ... });
  ...
}
```
Every request — including every batched call — pays for `getSession()`
before any procedure executes. Standalone `GET /api/auth/get-session` calls
in the same tail session independently clocked 618-1560ms. Strong
circumstantial match: the pre-DB gap is very likely `getSession()`'s own
(uninstrumented) DB round-trip via better-auth's `drizzleAdapter`, not
anything inside the procedures that were measured.

Also unaccounted for and still opaque: `post.list` took 2317ms/2397ms across
two separate calls with no `[DB]` log — not yet instrumented.

## Next step (not yet done — paused here)

Add a `[DB] context.getSession <ms>` log around the `getSession()` call in
`context.ts` to confirm it's the source of the pre-DB gap. This was the
natural next move but was explicitly deferred by the user to look at
something else (trending decay window) instead — pick back up here.

## Unrelated tangent from the same session

User asked about extending the trending list's window from 3h to ~5 days
(currently decays fast because `RECENT_WINDOW_HOURS` in
`packages/api/src/lib/trending.ts` is small). Started sketching the fix
(baseline would need to become a comparable ~5-day period too, not scaled by
the current 3h:21h ratio, plus `MENTION_RETENTION_DAYS` would need bumping
to cover the longer lookback) but user said skip for now — **no code was
changed**, `trending.ts` is untouched.
