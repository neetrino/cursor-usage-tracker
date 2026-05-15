# Cursor Usage Tracker (SQLite MVP)

Internal monorepo for attributing shared Cursor Ultra usage to real people by correlating:

- **Cursor usage events** (imported JSON and/or optional server-side sync)
- **Local AI-start markers** from Cursor Window logs (VS Code extension)

## Repo layout

- `apps/web` — Next.js (dashboard + route handlers + Prisma)
- `apps/extension` — VS Code/Cursor-compatible extension
- `apps/worker` — scheduled sync + matching
- `packages/shared` — Zod schemas, types, hashes, time helpers

## Prerequisites

- Node.js 20+ (22 used in CI smoke locally)
- pnpm 9 (`packageManager` is pinned in root `package.json`)

## Install

```bash
pnpm install
```

## Configure environment

Copy `.env.example` to the **repo root** `.env`. Next.js uses `envDir` (see `apps/web/next.config.ts`) so variables like `ADMIN_API_KEY` are read from the monorepo root — you do not need to duplicate them in `apps/web/.env` for the web app. Optionally keep `apps/web/.env` with `DATABASE_URL` if you run Prisma CLI only from `apps/web` and want a separate file.

At minimum set:

- `DATABASE_URL` (see notes below)
- `TRACKER_API_KEY` (extension → `POST /api/tracker/events`, `GET /api/tracker/health`)
- `ADMIN_API_KEY` (dashboard login + admin curl routes)

Optional Cursor usage sync (server-only):

- `CURSOR_USAGE_SYNC_ENABLED`
- `CURSOR_USAGE_API_URL`
- `CURSOR_USAGE_HEADERS_JSON`

Matching thresholds:

- `MATCH_MAX_DIFF_MS` (default `3000`)
- `MATCH_AUTO_CONFIDENT_MS` (default `1000`)

## Database migrations + seed

From repo root:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

`DATABASE_URL="file:./dev.db"` resolves relative to `apps/web/prisma/schema.prisma`, so the dev DB file is typically `apps/web/prisma/dev.db`.

## Run the web app

```bash
pnpm dev
```

Open `http://localhost:3000/dashboard` and sign in with `ADMIN_API_KEY`.

## Run the worker

```bash
pnpm worker
```

One-shot:

```bash
pnpm worker:once
```

The worker loads root `.env` first, then imports the same Prisma/matching modules as the web app.

## Build and package the extension

```bash
pnpm extension:build
pnpm extension:package
```

This writes `apps/extension/cursor-usage-tracker-extension-0.0.3.vsix`.

Install in Cursor:

- Command Palette → **Extensions: Install from VSIX…** → pick the `.vsix`
- Reload the window after upgrading so the new bundle is loaded.

## Configure the extension

Use **Cursor Usage Tracker: Open Settings** (or **Setup**, which opens the same panel). One webview collects:

- **Backend URL** (example `http://localhost:3000`)
- **Tracker API key** (matches server `TRACKER_API_KEY`) — stored only in VS Code **SecretStorage**, never in `globalState` or logs
- **userKey**, **userName**, **computerId**, **owningUser** (must match your `InternalUser` seed + Cursor usage JSON `owningUser`)
- **Cursor Account Group** (`ultra_1`, `ultra_2`, or custom label — optional metadata for your own reference)
- **Cursor log path** — use **Auto Discover** / **Browse File** / **Test Log Detection** from the panel

Non-secret values are saved in the extension **globalState** (with a one-time fallback to legacy workspace settings if present). **Test Backend Connection** calls `GET /api/tracker/health` with `x-tracker-api-key`.

Optional palette commands still work: **Set Cursor Log Path**, **Test Log Detection**, **Show Pending Events** (opens a JSON preview + count), **Sync Now**.

On Windows, **Auto Discover** scans `%APPDATA%\\Cursor\\logs\\**\\*.log`, scores recent files by marker hits, and prefers `renderer.log` when scores tie.

## Operational workflows

### Import Cursor usage JSON (dashboard)

Use **Settings → Manual JSON import** (server action) or curl:

```bash
curl -sS -H "x-admin-api-key: $ADMIN_API_KEY" -H "content-type: application/json" \
  -d @payload.json http://localhost:3000/api/cursor-usage/import
```

### Run matching

Use **Settings → Run matching now** or:

```bash
curl -sS -X POST -H "x-admin-api-key: $ADMIN_API_KEY" http://localhost:3000/api/matching/run
```

### Post local tracker events

```bash
curl -sS -H "x-tracker-api-key: $TRACKER_API_KEY" -H "content-type: application/json" \
  -d '{"events":[{"userKey":"edgar","userName":"Edgar","computerId":"pc-edgar","owningUser":"PLACEHOLDER_ULTRA_1","timestampMs":1,"timestampUtc":"1970-01-01T00:00:00.001Z","source":"cursor_window_log","marker":"buildRequestedModel","rawLineHash":"dummy"}]}' \
  http://localhost:3000/api/tracker/events
```

## Tests

```bash
pnpm test
```

## Production: Coolify on Hetzner (`apps/web` only)

Deploy the Next.js dashboard/API with Prisma on SQLite using the root **`Dockerfile.web`** and **`docker-compose.coolify.yml`**. **`apps/extension`** and **`apps/worker`** are not part of this stack. `.env` files are excluded from the Docker build context (`.dockerignore`); configure secrets in Coolify, not in the image.

### Image behavior

- **Base:** `node:22-bookworm-slim`; **pnpm:** Corepack `pnpm@9.15.0` (matches root `package.json`).
- **Build order:** `pnpm --filter @cursor-usage-tracker/shared build` → `pnpm --filter web exec prisma generate` → `pnpm --filter web build`.
- **Start:** `pnpm --filter web exec prisma migrate deploy && pnpm --filter web start`.
- **SQLite:** `DATABASE_URL=file:/data/cursor-usage.db`; named volume **`cursor_usage_data`** mounted at **`/data`**.
- **Port:** container listens on **3000**; compose uses **`expose`** only (no host `ports:`); Coolify’s reverse proxy targets the service.
- **Healthcheck:** `GET http://127.0.0.1:3000/api/tracker/health` with header **`x-tracker-api-key`** set from **`TRACKER_API_KEY`**.
- **`NEXT_PUBLIC_APP_NAME`:** optional compose default; `app/layout.tsx` falls back to `Cursor Usage Tracker` if unset.

### Environment variables

| Variable | Required | Default (compose) |
|----------|----------|-------------------|
| `TRACKER_API_KEY` | Yes | — |
| `ADMIN_API_KEY` | Yes | — |
| `MATCH_MAX_DIFF_MS` | No | `3000` |
| `MATCH_AUTO_CONFIDENT_MS` | No | `1000` |
| `NEXT_PUBLIC_APP_NAME` | No | `Cursor Usage Tracker` |

`DATABASE_URL` is set in compose to `file:/data/cursor-usage.db`; override only if you intentionally change the DB path.

### Coolify setup (summary)

1. On a Hetzner VPS (or any host), install [Coolify](https://coolify.io/docs).
2. Add a **Docker Compose** resource from this Git repository.
3. Set the compose file to **`docker-compose.coolify.yml`** and the build context to the **repository root**.
4. Add **`TRACKER_API_KEY`** and **`ADMIN_API_KEY`** in Coolify (same names the app already reads).
5. Attach a public domain / TLS in Coolify for the service.
6. After the first deploy, **seed** users/accounts if needed (Coolify one-off command or local `pnpm db:seed` against a DB copy). Migrations run on every container start.

### Local checks

```bash
docker compose -f docker-compose.coolify.yml config
docker compose -f docker-compose.coolify.yml build
```

For `build` / `up`, set `TRACKER_API_KEY` and `ADMIN_API_KEY` in your shell or a compose-only env file (not copied into the image).

## SQLite backup

See `docs/BACKUP.md`.

## Known limitations

- Timestamp correlation can mis-attribute concurrent usage on the same shared account; tune thresholds using real logs.
- Cursor log formats can change; keep the fallback marker enabled and monitor detection rates.
- MVP dashboard auth is a simple httpOnly cookie derived from `ADMIN_API_KEY` — tighten for wider exposure (VPN, SSO, etc.).

## Next recommended steps

- Replace placeholder `owningUser` values in seed data with real dashboard IDs.
- Calibrate `MATCH_MAX_DIFF_MS` / `MATCH_AUTO_CONFIDENT_MS` from production correlation quality.
- Add `.vscodeignore`/publisher metadata before distributing VSIX widely.
