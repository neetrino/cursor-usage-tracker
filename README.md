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
