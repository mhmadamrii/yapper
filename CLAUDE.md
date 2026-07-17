# Yapper

Portfolio social media app in the spirit of X / Bluesky. The goal is not another CRUD clone: each feature should replicate a *hard problem the big platforms (X, Facebook, Instagram, Bluesky) already solved* and implement it properly at portfolio scale. Depth over breadth — a small number of features done "the real way" beats many shallow ones.

## Problem areas to replicate (product roadmap)

When building features, prefer the production-grade pattern over the naive one:

- **Timeline / feed**: cursor-based (keyset) pagination, never OFFSET. Fan-out-on-write vs fan-out-on-read trade-off should be explicit in the design of the follow feed.
- **Engagement counters** (likes, reposts, replies): denormalized counts with atomic increments, not `COUNT(*)` per render.
- **Optimistic UI**: mutations (like, repost, follow) update the TanStack Query cache immediately and roll back on error.
- **Social graph**: follows, blocks, mutes — blocks/mutes must be enforced in feed and reply queries, not just hidden client-side.
- **Notifications**: aggregated ("X and 3 others liked your post"), with read/unread state.
- **Rate limiting & anti-spam**: per-user limits on writes at the API layer.
- **Media pipeline**: direct-to-storage uploads (presigned), size/type validation, responsive variants.
- **Search**: Postgres full-text search over posts/users before reaching for external engines.
- **Real-time**: start with polling/`refetchInterval`, upgrade to SSE or websockets where it matters.

Keep this list in mind when the user asks for a new feature — propose the "solved problem" version.

## Monorepo layout

pnpm workspaces + Turborepo. Dependency versions are pinned in the `catalog:` section of `pnpm-workspace.yaml` — add shared deps there, reference with `"catalog:"`.

| Path | Package | What it is |
|---|---|---|
| `apps/web` | `web` | TanStack Start (React 19, Vite 8, file-based routing), port 3001, deploys to Vercel |
| `apps/server` | `server` | Hono app exposing tRPC + better-auth handlers, deploys to Cloudflare Workers |
| `packages/api` | `@yapper/api` | tRPC init, context, and routers (`src/routers/`) |
| `packages/auth` | `@yapper/auth` | better-auth setup (`createAuth()`) |
| `packages/db` | `@yapper/db` | Drizzle ORM + Neon serverless Postgres; schema in `src/schema/`, `createDb()` factory |
| `packages/env` | `@yapper/env` | t3-env validated env vars — import from `@yapper/env/server` or `@yapper/env/web`, never `process.env` directly |
| `packages/ui` | `@yapper/ui` | Shared shadcn/base-ui components, Tailwind 4, `globals.css` |
| `packages/infra` | `@yapper/infra` | Alchemy IaC for the Cloudflare side |
| `packages/config` | `@yapper/config` | Shared tsconfig |

## Commands (run from repo root)

```sh
pnpm dev             # all apps via turbo
pnpm dev:web         # web only (port 3001)
pnpm dev:server      # server only
pnpm build
pnpm check-types     # tsc across workspaces
pnpm format          # prettier --write

pnpm db:push         # drizzle-kit push (dev schema sync)
pnpm db:generate     # generate migrations
pnpm db:migrate
pnpm db:studio

pnpm deploy:web:prod # Vercel prod deploy
pnpm deploy:server   # Alchemy deploy to Cloudflare
```

## Conventions

- **tRPC**: add routers under `packages/api/src/routers/` and merge into `appRouter` in `routers/index.ts`. Use `publicProcedure` / `protectedProcedure` from `packages/api/src/index.ts`; `protectedProcedure` guarantees `ctx.session`.
- **DB**: one schema file per domain in `packages/db/src/schema/`, re-exported from `schema/index.ts`. Get a client via `createDb()` (per-request, Neon HTTP driver — no long-lived pool).
- **Web routes**: file-based under `apps/web/src/routes/`. `routeTree.gen.ts` is generated — never edit it by hand. Authed routes live under `routes/_auth/`.
- **Data fetching (web)**: tRPC client via `apps/web/src/utils/trpc.ts` + TanStack Query.
- **Auth**: better-auth; server mounts it at `/api/auth/*`; web client in `apps/web/src/lib/auth-client.ts`.
- **Vite config gotcha**: `ssr.noExternal: true` must stay build-only (see `apps/web/vite.config.ts`) — enabling it in dev makes the module runner evaluate CJS deps as ESM and crash with `module is not defined`.
- New workspace packages: `"type": "module"`, export raw TS from `src/` via the `exports` map (no build step for internal packages).
