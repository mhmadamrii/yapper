# Migrate media from ImageKit to self-hosted MinIO

## Current state (as-is)

- Client uploads go **direct to ImageKit**, never through our server. Server only mints a short-lived signed auth token (`packages/api/src/routers/media.ts` — `media.uploadAuth`, HMAC-SHA1 of `token+expire` keyed with `IMAGEKIT_PRIVATE_KEY`). No `imagekit` SDK anywhere — everything is hand-rolled `fetch`.
- Render-time images use ImageKit's on-the-fly transform API: `apps/web/src/lib/imagekit.ts` → `imageKitUrl(filePath, transforms)` builds `${VITE_IMAGEKIT_URL_ENDPOINT}/tr:${transforms}${filePath}`.
- DB stores a bare ImageKit `filePath` (+ `fileId` for deletion) in `post_media`, `draft_media`, `user_profile.bannerPath`. **Exception:** `user.image` (avatar, better-auth-owned column) stores a fully-baked transformed URL, not a bare path — an existing inconsistency worth fixing while we're touching every call site.
- Transform strings in use today: `w-400,f-auto,q-auto` / `w-1200,f-auto,q-auto` / `w-800,f-auto,q-auto` / `w-200,f-auto,q-auto` / `w-400,h-400,f-auto,q-auto` (avatar) / `w-1200,h-400,fo-auto,f-auto,q-auto` (banner, `fo-auto` = smart crop).
- Env vars: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY` (server), `VITE_IMAGEKIT_URL_ENDPOINT` (web/client).
- MinIO is **already running** on the VPS as part of the `kommers` stack (container `kommers_minio_1`, image `quay.io/minio/minio`, ports 9000–9001, network alias `minio` on `kommers_net`) — reuse it, don't stand up a second instance.

## Core gap

MinIO is just object storage — no on-the-fly resize/format/crop like ImageKit's `/tr:`. Need an image-processing proxy in front of it. Plan uses **imgproxy** (`darthsim/imgproxy`): signs URLs with a shared secret (no accounts/DB), supports width/height/smart-crop/quality — closest match to what `imageKitUrl()` already does, runs as one more container.

## Steps

Each step is tagged **[YOU]** (needs VPS SSH access, an external dashboard, or a production action I can't/shouldn't take unilaterally) or **[ME]** (code change I make in this repo).

### 1. Provision storage
- **[YOU]** On the VPS, create a dedicated bucket (e.g. `yapper-media`) inside the existing `kommers_minio_1` container via `mc` (MinIO client), and a **scoped** access key/secret limited to that bucket (not the root creds). Set the bucket private (no public reads — imgproxy is the only reader).

### 2. Add imgproxy to the deploy stack
- **[ME]** Add a `yapper-imgproxy` service to `deploy/podman-compose.yml`: image `darthsim/imgproxy`, on `kommers_net`, env `IMGPROXY_KEY`/`IMGPROXY_SALT` (signing secret), `IMGPROXY_USE_S3=true`, `IMGPROXY_S3_ENDPOINT=http://minio:9000`, bucket creds, dummy `IMGPROXY_S3_REGION`.
- **[ME]** Give you the exact Caddy block to append (same pattern as `api.yappers.online`): `media.yappers.online { reverse_proxy yapper_imgproxy:8080 }`.
- **[YOU]** Append that block to `/home/deploy/kommers/Caddyfile` on the VPS and run `podman restart kommers_caddy_1` (reload has been unreliable this session — restart is the proven-working path). Confirm `media.yappers.online` gets a cert and responds.
- **[YOU]** Run the updated `deploy:server` (already wired to run `yapper-migrate` first) to build/start `yapper-imgproxy` alongside `yapper-server`.

### 3. Replace ImageKit's client-upload with a MinIO presigned PUT
- **[ME]** Rewrite `packages/api/src/routers/media.ts`: swap the ImageKit HMAC-auth mutation for one that generates a presigned S3 PUT URL (via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, MinIO is S3-compatible). Server generates the object key (`${userId}/${crypto.randomUUID()}.${ext}`) so users can't pick arbitrary paths, and validates content-type/size before minting the URL.
- **[ME]** Replace `apps/web/src/lib/imagekit.ts` with `apps/web/src/lib/media.ts`: `uploadToStorage(file, uploadUrl)` does a plain `fetch(uploadUrl, { method: 'PUT', body: file })` — same "file bytes never touch our server" property preserved.
- **[ME]** Update all ~8 call sites (`dialog-create-post.tsx`, `dialog-create-reply.tsx`, `dialog-create-quote.tsx`, `dialog-edit-profile.tsx`) to the new upload flow.

### 4. Replace ImageKit's `/tr:` transforms with imgproxy signed URLs
- **[ME]** Add `mediaUrl(objectKey, opts)` building a signed imgproxy URL against `media.yappers.online`, mapping existing transform strings 1:1 (`w-400` → `rs:fit:400`, `fo-auto` → imgproxy smart gravity — verify this looks right visually before relying on it for banners; center-crop is an acceptable fallback if smart-crop needs more tuning).
- **[ME]** Update every render call site found in the investigation (post cards, post detail, quoted-post preview, drafts list, composer thumbnails, avatar, banner) to use `mediaUrl()` instead of `imageKitUrl()`.
- **[ME]** Fix the `user.image` inconsistency while touching these files: decide to either keep baking the transformed URL in at upload time, or store a bare key and resolve via `mediaUrl()` at render like everything else (recommended, for consistency).

### 5. Schema
- **[ME]** `post_media`, `draft_media`, `user_profile.bannerPath` — same column shape works (still a bare object key); optionally rename `filePath` → `objectKey` for clarity (small migration + `db:push`).
- **[ME]** Drop or repurpose `fileId` columns (ImageKit-specific, "needed for deletion via their API" — MinIO deletion just needs the object key already in `filePath`).
- **[YOU]** Run the resulting `db:push`/migration against the VPS Postgres (I'll hand you the exact command, same pattern as the `trending_topic` fix earlier this session).

### 6. Migrate existing media
- **[ME]** Write a backfill script: for every `post_media`/`draft_media`/`bannerPath`/`user.image` row, download the original from ImageKit and re-upload to MinIO under a new key, then update the row.
- **[YOU]** Confirm you're OK with me running this against production data once MinIO creds exist (low data volume currently, so this should be quick and low-risk, but it's a production data mutation so it gets your explicit go-ahead first).

### 7. Env vars & cleanup
- **[ME]** Remove `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `VITE_IMAGEKIT_URL_ENDPOINT` from `packages/env/src/*.ts`, `.env.example` files, and add `VITE_MEDIA_URL_ENDPOINT` (`https://media.yappers.online`) plus server-only imgproxy signing key/salt and MinIO bucket creds.
- **[YOU]** Update the actual secret values in `apps/server/.env` / `apps/server/.env.production` / `apps/web/.env.production` (I can point you at exactly which keys go where, but the real secret values should come from you, not be echoed through me).
- **[ME]** Sync the non-secret prod web vars via `pnpm env:production` (uses `apps/web/.env.production`, already fixed to target the right file).
- **[YOU]** Delete the old Cloudflare `alchemy.run.ts` ImageKit bindings if that Workers path is fully dead (confirm first — don't want to break something still relying on it).
- **[YOU]** Once everything's verified working, cancel/delete the ImageKit account.

### 8. Rollout order (learned from today's session — verify each layer before moving on)
1. **[YOU]** Stand up MinIO bucket + imgproxy container + Caddy block on the VPS first. Verify in isolation: manual `curl -T` PUT to a presigned-style URL, manual imgproxy transform URL — **before** any app code changes ship.
2. **[ME]** Land the presign + `mediaUrl()` app code, test upload+render end-to-end against MinIO manually (local dev, pointed at the real VPS MinIO/imgproxy).
3. **[ME + YOU]** Run the backfill script (my script, your go-ahead to run it against prod).
4. **[YOU]** Redeploy both `apps/server` (VPS) and `apps/web` (Vercel prod deploys are gated to you, per this session's permission rules).
5. **[YOU]** Confirm nothing 500s before deleting the ImageKit account/keys.
