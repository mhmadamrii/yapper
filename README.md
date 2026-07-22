# Yapper

Portfolio social media app in the spirit of X / Bluesky.

Not another CRUD clone — each feature replicates a **hard problem** big platforms (X, Facebook, Instagram, Bluesky) already solved, implemented properly at portfolio scale. Depth over breadth: a small number of features done "the real way" beats many shallow ones.

## Problem areas being replicated

- **Timeline / feed** — cursor-based (keyset) pagination, never `OFFSET`. Fan-out-on-write vs fan-out-on-read trade-off explicit in the follow feed design.
- **Engagement counters** (likes, reposts, replies) — denormalized counts with atomic increments, not `COUNT(*)` per render.
- **Optimistic UI** — mutations (like, repost, follow) update the TanStack Query cache immediately, roll back on error.
- **Social graph** — follows, blocks, mutes, enforced in feed/reply queries server-side, not just hidden client-side.
- **Notifications** — aggregated ("X and 3 others liked your post"), read/unread state.
- **Rate limiting & anti-spam** — per-user limits on writes at the API layer.
- **Media pipeline** — direct-to-storage uploads (presigned), size/type validation, responsive variants.
- **Search** — Postgres full-text search over posts/users before reaching for external engines.
- **Real-time** — polling/`refetchInterval` first, upgrade to SSE/websockets where it matters.

## Stack

- **TypeScript** end to end
- **TanStack Start** — SSR framework with TanStack Router (React 19, Vite 8)
- **Hono** — server framework, tRPC + better-auth handlers
- **tRPC** — end-to-end type-safe APIs
- **Drizzle ORM** + **PostgreSQL** (Neon serverless)
- **better-auth** — authentication
- **TailwindCSS** + shared shadcn/ui primitives
- **pnpm workspaces + Turborepo** — monorepo

## Monorepo layout

| Path              | Package          | What it is                                                                                                      |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/web`        | `web`            | TanStack Start (React 19, Vite 8, file-based routing), port 3001, deploys to Vercel                             |
| `apps/server`     | `server`         | Hono app exposing tRPC + better-auth handlers, deploys to Cloudflare Workers                                    |
| `packages/api`    | `@yapper/api`    | tRPC init, context, and routers (`src/routers/`)                                                                |
| `packages/auth`   | `@yapper/auth`   | better-auth setup (`createAuth()`)                                                                              |
| `packages/db`     | `@yapper/db`     | Drizzle ORM + Neon serverless Postgres; schema in `src/schema/`, `createDb()` factory                           |
| `packages/env`    | `@yapper/env`    | t3-env validated env vars — import from `@yapper/env/server` or `@yapper/env/web`, never `process.env` directly |
| `packages/ui`     | `@yapper/ui`     | Shared shadcn/base-ui components, Tailwind 4, `globals.css`                                                     |
| `packages/infra`  | `@yapper/infra`  | Alchemy IaC for the Cloudflare side                                                                             |
| `packages/config` | `@yapper/config` | Shared tsconfig                                                                                                 |

Dependency versions are pinned in the `catalog:` section of `pnpm-workspace.yaml` — add shared deps there, reference with `"catalog:"`.

## Getting Started

```bash
pnpm install
```

### Database setup

Project uses PostgreSQL (Neon) with Drizzle ORM.

1. Set up a PostgreSQL database.
2. Update `apps/server/.env` with your connection details.
3. Push schema:

```bash
pnpm db:push
```

### Run dev

```bash
pnpm dev
```

- Web: [http://localhost:3001](http://localhost:3001)
- API: [http://localhost:3000](http://localhost:3000)

## Commands (run from repo root)

```bash
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

- **tRPC** — add routers under `packages/api/src/routers/`, merge into `appRouter` in `routers/index.ts`. Use `publicProcedure` / `protectedProcedure` from `packages/api/src/index.ts`; `protectedProcedure` guarantees `ctx.session`.
- **DB** — one schema file per domain in `packages/db/src/schema/`, re-exported from `schema/index.ts`. Get a client via `createDb()` (per-request, Neon HTTP driver — no long-lived pool).
- **Web routes** — file-based under `apps/web/src/routes/`. `routeTree.gen.ts` is generated — never edit by hand. Authed routes live under `routes/_auth/`.
- **Data fetching (web)** — tRPC client via `apps/web/src/utils/trpc.ts` + TanStack Query.
- **Conditional rendering (web)** — use SolidJS-style components from `apps/web/src/components/control-flow.tsx`: `<Show when={...}>`, `<Switch>`/`<Match>`, `<For each={...}>`. Prefer these over `&&`, nested ternaries, bare `.map()` in JSX.
- **Auth** — better-auth; server mounts at `/api/auth/*`; web client in `apps/web/src/lib/auth-client.ts`.
- **Vite gotcha** — `ssr.noExternal: true` must stay build-only (see `apps/web/vite.config.ts`). Enabling in dev makes the module runner evaluate CJS deps as ESM → crashes with `module is not defined`.
- New workspace packages: `"type": "module"`, export raw TS from `src/` via the `exports` map (no build step for internal packages).

## UI Customization

Shared shadcn/ui primitives live in `packages/ui`.

- Design tokens / global styles: `packages/ui/src/styles/globals.css`
- Shared primitives: `packages/ui/src/components/*`
- shadcn aliases / style config: `packages/ui/components.json` and `apps/web/components.json`

Add more shared components (run from repo root):

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components:

```tsx
import { Button } from '@yapper/ui/components/button';
```

App-specific blocks (not shared): run the shadcn CLI from `apps/web` instead.

## Deployment

### Server → Cloudflare via Alchemy

- Dev: `pnpm dev:server`
- Deploy: `pnpm deploy:server`
- Destroy: `pnpm destroy`

Guide: [Deploying to Cloudflare with Alchemy](https://www.better-t-stack.dev/docs/guides/cloudflare-alchemy)

### Web → Vercel

- Config: `vercel.json`
- Link project first: `pnpm deploy:setup`
- Local Vercel dev: `pnpm dev:vercel`
- Sync preview env: `pnpm env:preview`
- Sync production env: `pnpm env:production`
- Dry-run check (no upload): `pnpm deploy:check`
- Preview deploy: `pnpm deploy:web`
- Production deploy: `pnpm deploy:web:prod`

Vercel shares project env vars, but deploys don't upload local `.env` files automatically. Link with `vercel link`, then sync env before first deploy (else deploy starts with no env vars), or pass one-off envs with `vercel deploy -e KEY=value`. Pass Vercel CLI flags to env sync commands directly, e.g. `pnpm env:production --scope your-team`.

Guide: [Deploying to Vercel](https://www.better-t-stack.dev/docs/guides/vercel)

## Project Structure

```
yapper/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Start)
│   └── server/      # Backend API (Hono, tRPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # tRPC routers / business logic
│   ├── auth/        # Authentication configuration & logic
│   ├── db/          # Database schema & queries
│   ├── env/         # Validated env vars
│   ├── infra/       # Alchemy IaC (Cloudflare)
│   └── config/      # Shared tsconfig
```

## Available Scripts

- `pnpm dev` — start all apps
- `pnpm build` — build all apps
- `pnpm dev:web` / `pnpm dev:server` — start one app
- `pnpm check-types` — tsc across workspaces
- `pnpm format` — prettier --write
- `pnpm db:push` / `db:generate` / `db:migrate` / `db:studio`
- `pnpm deploy:setup` — link repo to Vercel project (first-time)
- `pnpm dev:vercel` — run Vercel Services dev env locally
- `pnpm env:preview` / `env:production` — sync env to Vercel
- `pnpm deploy:web` / `deploy:web:prod` — Vercel preview/prod deploy
- `pnpm deploy:check` — dry-run deploy check
