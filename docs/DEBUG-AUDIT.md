# DEBUG-AUDIT — Cursor Usage Tracker

**Date:** 2026-05-18  
**Scope:** Full read-only architecture and risk audit before sync-mode refactor.  
**Production URL (referenced in repo):** https://cursor.neetrino.com

---

## Executive summary

| Area | Status |
|------|--------|
| Local extension → tracker API | **Implemented and sound** (metadata-only, SecretStorage for tracker key, queue/retry) |
| Usage import + matching | **Implemented** (manual JSON, Tampermonkey browser push, dedupe hashes, greedy matcher) |
| Server-side Cursor dashboard sync | **Not viable for production** — code exists but intentionally falls back; cookie replay blocked |
| `CURSOR_USAGE_SYNC_MODE` env | **Not implemented** — behavior is implicit today |
| `POST /api/cursor-usage/sync` | **Does not exist** — only `sync-manual` + `import` |
| Worker | **Broken import** (`prisma` vs `getPrisma`); only runs matching, not usage sync |
| Extension Cursor usage CSV sync | **Removed** — extension no longer stores admin key or imports usage (dashboard/Tampermonkey only) |
| Extension markers | **Fixed** — only `[buildRequestedModel]` creates events; wakelock diagnostic-only |
| Extension auth | **Device tokens** — per-user Bearer token; admin/global keys removed from extension UI |
| Auto log discovery | **Implemented** — periodic `window*\renderer.log` discovery without manual Auto Discover |

**Recommended direction:** Formalize sync modes (`disabled` | `manual_import` | `browser_companion` | `official_api`), remove server cookie replay paths, use a dedicated **import key** for browser companions (not full `ADMIN_API_KEY`), keep Tampermonkey as the interim `browser_companion`.

---

## 1. Monorepo architecture

### `apps/web` (Next.js 15 App Router)

- **Role:** Dashboard, admin server actions, REST APIs, Prisma/SQLite.
- **Key paths:**
  - `app/api/tracker/*` — extension ingestion (`x-tracker-api-key`)
  - `app/api/cursor-usage/import` — usage JSON import (`x-admin-api-key`)
  - `app/api/cursor-usage/sync-manual` — server attempt + Tampermonkey fallback hint
  - `app/api/matching/run` — matching pass (`x-admin-api-key`)
  - `app/api/dashboard/*` — JSON APIs for admin tooling (`x-admin-api-key`)
  - `app/dashboard/(secure)/*` — UI (cookie session via `ADMIN_API_KEY` hash)
  - `src/server/*` — auth, db, import, matching, dashboard summary
  - `prisma/schema.prisma` — SQLite models
- **Env loading:** `next.config.ts` sets `envDir` to monorepo root (`.env` at repo root).
- **Build safety:** `src/instrumentation.ts` skips SQLite PRAGMA during `next build`; Dockerfile sets `DATABASE_URL=file:/tmp/cursor-usage-build.db` for build only.

### `apps/extension` (VS Code / Cursor)

- **Role:** Tail Cursor Window logs, detect AI-start markers, POST metadata to backend.
- **Activation:** `onStartupFinished`.
- **Commands (package.json):** Open Settings, Setup, Set Log Path, Test Log Detection, Show Pending Events, Sync Now (queue flush only).
- **Not wired:** `syncCursorUsage()` in `cursorUsageSync.ts` (CSV pull + admin import) — no timer, no command, no webview handler.

### `apps/worker`

- **Role (intended in docs):** Scheduled upstream sync + matching.
- **Role (actual code):** Hourly `runMatchingPass` only.
- **Bug:** `apps/worker/src/index.ts` imports `{ prisma }` from `apps/web/src/server/db.ts`, but `db.ts` only exports `getPrisma()` and `ensureSqlitePragmas()`. Worker will fail at import/runtime until fixed.
- **Not deployed** in `docker-compose.coolify.yml` (web-only stack).

### `packages/shared`

- **Exports:** `hash.ts`, `time.ts`, `confidence.ts`, `schemas.ts` (Zod).
- **Dedupe:**
  - Usage `rawHash`: `owningUser|timestampMs|model|input|output|cacheRead`
  - Local `rawLineHash`: `userKey|computerId|owningUser|timestampMs|marker|normalizedLine`
- **Matching helpers:** `calculateDiffMs`, `matchConfidenceFromDiffMs` (fixed tiers; env thresholds used in web matcher only).
- **Build:** tsup dual CJS/ESM for extension bundle.

---

## 2. Deployment (Coolify / Docker)

### Files

| File | Purpose |
|------|---------|
| `Dockerfile.web` | Multi-stage: install with `--prod=false`, build shared → prisma generate → `next build` |
| `docker-compose.coolify.yml` | Single `web` service, volume `cursor_usage_data:/data` |
| `.dockerignore` | Excludes `.env*`, `node_modules`, `.next`, secrets |

### Database URLs

| Phase | `DATABASE_URL` |
|-------|----------------|
| **Docker build** | `file:/tmp/cursor-usage-build.db` (set in Dockerfile before `next build`) |
| **Runtime (compose)** | `file:/data/cursor-usage.db` |
| **Local dev** | `file:./dev.db` (relative to Prisma schema → typically `apps/web/prisma/dev.db`) |

### Coolify assumptions (from compose + README)

- Secrets: `TRACKER_API_KEY`, `ADMIN_API_KEY` (not baked into image; `.dockerignore` blocks `.env`).
- Optional: `MATCH_MAX_DIFF_MS`, `MATCH_AUTO_CONFIDENT_MS`, `NEXT_PUBLIC_APP_NAME`.
- Healthcheck: `GET /api/tracker/health` with `x-tracker-api-key` from container env.
- Start command: `prisma migrate deploy` then `next start`.
- **Do not** set `DATABASE_URL=file:./dev.db` in production Coolify env (overrides compose volume path).

### Dockerfile nuance

- Comment mentions avoiding production `NODE_ENV` skipping devDeps; install uses `pnpm install --frozen-lockfile --prod=false`.
- Builder then sets `ENV NODE_ENV=production` before compile (differs from some docs that say `NODE_ENV=development` in builder — current file uses production after install).

---

## 3. Extension flow (local tracking)

### Settings storage

| Key | Storage | Sent to server? |
|-----|---------|-----------------|
| `backendUrl`, `userKey`, `userName`, `computerId`, `owningUser`, `cursorAccountGroup`, `cursorLogPath` | `globalState` (+ workspace fallback) | Yes (except `cursorAccountGroup`) |
| `trackerApiKey` | VS Code **SecretStorage** | Header `x-tracker-api-key` |
| `adminApiKey` | VS Code **SecretStorage** | Header `x-admin-api-key` on usage import only |
| Queue payloads | `pending-events.json` in extension global storage | Metadata fields only |

### Log detection

- Markers (`markers.ts`): `[buildRequestedModel]`; `[ComposerWakelockManager] Acquired wakelock` + `reason="agent-loop"`.
- Timestamp: `parseCursorLocalLogTimestampToMs` — native `Date` from log prefix (no Luxon).
- Tail: byte offset per log path; **no historical replay** on first open (starts at EOF).
- Watch: `FileSystemWatcher` + 2s poll fallback.

### Local event payload (safe subset)

`userKey`, `userName`, `computerId`, `owningUser`, `timestampMs`, `timestampUtc`, `source`, `marker`, `rawLineHash` — no prompt/code/cookies.

### Queue / retry

- Immediate POST; on failure → `enqueue`.
- Retry: 60s interval + command **Sync Now** / webview **Sync Pending Events**.
- Diagnostics: `diagnosticChannel.ts` logs scope + stack (no secrets).

### Backend endpoints used by extension

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/tracker/health` | `x-tracker-api-key` | Test connection |
| `POST /api/tracker/events` | `x-tracker-api-key` | Local events |
| `POST /api/cursor-usage/import` | `x-admin-api-key` | Only if `syncCursorUsage` were called (currently unused) |

### Extension risks

1. **ADMIN_API_KEY in IDE extension** — `config.ts` + settings webview encourage storing full admin key for CSV import that **never runs**. Violates stated boundary (“extension only tracker key”).
2. **Misleading UI** — webview hint: “fetches Cursor usage CSV every 10 minutes when saved” — **false** (no scheduler).
3. **`tampermonkey-cursor-sync.js`** in repo contains example `ADMIN_API_KEY: 'admin123'` — rotate if ever committed to a public remote.

---

## 4. Backend flow

### Tracker

- `GET /api/tracker/health` → `{ ok, service, time }`
- `POST /api/tracker/events` → Zod validate, dedupe `rawLineHash`, link `InternalUser` if `userKey` + `owningUser` match, `runMatchingPass`

### Cursor usage import

- `POST /api/cursor-usage/import` → normalize rows, dedupe `rawHash`, `SyncRun` audit, optional match.
- Sources recorded: `manual_import`, `cursor_usage_api` (server sync success path).

### Cursor usage “sync”

- **No** `POST /api/cursor-usage/sync`.
- `POST /api/cursor-usage/sync-manual`:
  - Auth: `x-admin-api-key` **or** admin session cookie.
  - Calls `runManualCursorSync()`:
    - If `CURSOR_USAGE_HEADERS_JSON` unset → `clientSyncRequired: true` (Tampermonkey hint).
    - If set → `fetch` to `CURSOR_USAGE_API_URL` or default `https://cursor.com/api/dashboard/get-filtered-usage-events` with merged headers.
    - On non-OK or error → same client fallback (no cookie logging).
- Dashboard **Sync from Cursor now** button uses this route (client component).

### Matching

- `POST /api/matching/run` (admin key).
- Also triggered after import and after tracker events.
- Greedy one-to-one by time order; env: `MATCH_MAX_DIFF_MS`, `MATCH_AUTO_CONFIDENT_MS`.

### Dashboard

- Cookie = SHA-256 of `cursor-usage-admin:${ADMIN_API_KEY}`.
- Pages under `(secure)/` use `force-dynamic` + `revalidate = 0`.
- `not-found.tsx` is static (build-safe).
- `buildDashboardSummary()` loads **all** `CursorUsageEvent` rows into memory — will not scale past tens of thousands of rows.

### BigInt JSON

- API routes use `jsonResponse()` with BigInt → string replacer.
- Dashboard tables render `timestampUtc` as `Date` (safe).

---

## 5. Cursor upstream sync problem

### What the code tries (server)

`apps/web/src/server/cursor-usage-sync-manual.ts`:

1. Read `CURSOR_USAGE_HEADERS_JSON` (intended to hold browser-like headers + `Cookie: WorkosCursorSessionToken=...`).
2. POST JSON body `{ teamId, startDate, endDate, page: 1, pageSize: 100 }`.
3. Import response via shared normalizer.

### Why it fails in production

| Observation | Implication |
|-------------|-------------|
| Browser + `credentials: 'include'` → **200 JSON** | Session bound to browser context (cookies, origin, likely bot/fingerprint checks) |
| Server + same cookie string → **403** | IP/datacenter + non-browser TLS fingerprint |
| Server + browser-like headers → **redirect to login** (`NEXT_REDIRECT` in Next fetch) | Cookie replay without full browser session is rejected |

**Conclusion:** Cursor protects internal dashboard APIs. **Do not** build production on `WorkosCursorSessionToken` server replay, header spoofing, or bypass logic.

### What works today (browser companion)

`tampermonkey-cursor-sync.js`:

- Runs on `cursor.com` with user’s real session.
- `fetch(..., credentials: 'include')` to `get-filtered-usage-events`.
- `GM_xmlhttpRequest` POST to backend `/api/cursor-usage/import` with `x-admin-api-key`.

This is the correct **browser_companion** pattern (Tampermonkey is a stand-in until a dedicated Chrome extension).

### Env variables (sync-related)

| Variable | Used? | Notes |
|----------|-------|-------|
| `CURSOR_USAGE_HEADERS_JSON` | Yes | Server sync attempt; README says remove in Coolify |
| `CURSOR_USAGE_API_URL` | Yes | Optional override URL |
| `CURSOR_USAGE_SYNC_ENABLED` | **No** (dead) | Mentioned only in stale `docs/TESTING_PLAN.md` |
| `CURSOR_USAGE_SYNC_MODE` | **No** | Proposed in this audit |

### Pagination gap

Server and Tampermonkey only request **page 1, pageSize 100**. High-volume accounts will miss events unless lookback windows overlap and dedupe catches repeats.

---

## 6. Risks and bugs (prioritized)

### P0 — Correctness / security

1. **Server cookie replay path** — `runManualCursorSync` + env headers encourage unsafe ops; should be gated/disabled by sync mode.
2. **ADMIN_API_KEY in Tampermonkey / extension** — full admin power from browser; prefer scoped `IMPORT_API_KEY` with import-only scope.
3. **Worker broken** — `import { prisma }` does not exist; worker cannot run as-is.

### P1 — Functional gaps

4. **`syncCursorUsage` dead** — extension UI promises CSV sync every 10 minutes; no implementation hook.
5. **No `/api/cursor-usage/sync`** — docs/user brief expect it; only `sync-manual`.
6. **Single-page import** — 100 events max per sync window.
7. **Dashboard summary O(n) full table scan** — memory risk.

### P2 — Docs / drift

8. `docs/ARCHITECTURE.md` — worker sync via `CURSOR_USAGE_*`.
9. `docs/IMPLEMENTATION_PLAN.md` Phase 10 — “10 minute loop: optional upstream sync”.
10. `docs/TESTING_PLAN.md` — `CURSOR_USAGE_SYNC_ENABLED` + worker `SyncRun` source `cursor_usage_api`.
11. `docs/PROGRESS.md` — worker “10 minute loop” marked complete.
12. Extension webview copy vs behavior.

### P3 — Hardening (lower urgency)

13. Admin session = raw `ADMIN_API_KEY` typed at login (same secret as API header).
14. `rawJson` on usage events stores full Cursor row — ensure imports never contain prompts (API shape today is token metadata only; monitor).
15. Duplicate migration folders (`20260114120000_init`, `20260514175050_init`) — verify deploy history on production DB.
16. Untracked duplicate path `apps\web\app\dashboard\(secure)\layout.tsx` in git status — reconcile with forward-slash path.

### Verified fixes (still good)

- `markers.ts` guards `line` before `.includes`.
- `instrumentation.ts` skips DB on build.
- Dashboard DB routes/pages use `force-dynamic`.
- `jsonResponse` handles BigInt.
- Save settings allows empty `cursorLogPath`.
- Webview/command errors go through `runWithDiagnostics` / try-catch.

---

## 7. What works end-to-end

1. Extension detects markers and POSTs local metadata with tracker key.
2. Queue + Sync Now flush when backend is down.
3. Manual JSON import (dashboard textarea + curl).
4. Tampermonkey hourly import when logged into cursor.com (browser companion).
5. Matching pass with configurable thresholds.
6. Dashboard tables, settings, sync run history.
7. Docker build/runtime DB separation and `/data` volume pattern.
8. Healthcheck for Coolify.

---

## 8. Recommended safe sync architecture

### Env: `CURSOR_USAGE_SYNC_MODE`

| Mode | Server behavior | Client responsibility |
|------|-----------------|----------------------|
| `disabled` | `POST /api/cursor-usage/sync` → **409** with clear JSON body; `sync-manual` same or redirects hint | Local extension only |
| `manual_import` | Import + matching enabled; sync endpoints disabled | Admin pastes JSON / curl |
| `browser_companion` | Import via **`x-import-api-key`** (new) or dedicated route; **no** server-side Cursor fetch | Tampermonkey / future Chrome ext pushes JSON |
| `official_api` | Server fetch using **official** Cursor API credentials (when available) | None |

**Default for production:** `browser_companion` or `manual_import` (not `disabled` if you need usage data).

### Auth split

| Key | Scope |
|-----|-------|
| `TRACKER_API_KEY` | `POST /api/tracker/events`, health |
| `IMPORT_API_KEY` (new, optional) | `POST /api/cursor-usage/import` only |
| `ADMIN_API_KEY` | Dashboard login, matching, dashboard JSON APIs, destructive admin |

Tampermonkey should use `IMPORT_API_KEY`, not `ADMIN_API_KEY`.

### Remove / gate

- Stop documenting `CURSOR_USAGE_HEADERS_JSON` for Coolify.
- Remove or hard-disable server `fetch` to cursor.com when mode ≠ `official_api`.
- Remove admin key field from VS Code extension UI; keep tracker-only extension.

### Keep

- Tampermonkey script (update to import key).
- Manual dashboard import.
- Local extension path unchanged.

---

## 9. What should be fixed first

1. Add `CURSOR_USAGE_SYNC_MODE` + behavior in sync routes (no cookie fetch in default modes).
2. Fix worker `getPrisma()` import (or document worker as deprecated).
3. Update Tampermonkey to `IMPORT_API_KEY`; remove example password from repo script comments.
4. Align docs (`ARCHITECTURE`, `TESTING_PLAN`, `PROGRESS`, README) with actual behavior.
5. Remove or wire `syncCursorUsage` — **prefer remove** from extension and rely on browser companion.
6. Add pagination or rolling import for `usageEventsDisplay` in Tampermonkey/server official API path.

---

## 10. What should NOT be attempted

- Storing or logging `WorkosCursorSessionToken` on the server.
- Cloudflare / Vercel / bot bypass, headless “logged-in” scraping.
- Sending prompt text, source code, or Cursor cookies from the VS Code extension.
- PostgreSQL migration without explicit request.
- `file:./dev.db` in Coolify production `DATABASE_URL`.
- Making the entire Next app dynamic when route-level `force-dynamic` suffices.
- Relying on `requestId` / `composerId` for MVP matching.

---

## 11. Proposed code changes (plan only — not implemented in this audit)

| File / area | Change |
|-------------|--------|
| `apps/web/src/server/env.ts` | `getCursorUsageSyncMode()` enum parser |
| `apps/web/app/api/cursor-usage/sync/route.ts` | **New** — mode-aware sync entry |
| `apps/web/src/server/cursor-usage-sync-manual.ts` | Respect mode; delete cookie fetch unless `official_api` |
| `apps/web/src/server/auth.ts` | `verifyImportApiKey`, optional separate env |
| `docker-compose.coolify.yml`, `.env.example` | Document `CURSOR_USAGE_SYNC_MODE`, `IMPORT_API_KEY` |
| `tampermonkey-cursor-sync.js` | Use import key; optional pagination loop |
| `apps/extension` | Remove admin key UI + `cursorUsageSync.ts` or document as deprecated |
| `apps/worker/src/index.ts` | `getPrisma()` fix; optional: only run matching if mode allows |
| `docs/*` | Single source of truth for sync modes |

---

## 12. Open questions

1. Does Cursor publish an official usage API / team token for `official_api` mode?
2. Should Tampermonkey remain the companion or invest in a minimal Chrome extension (MV3)?
3. Production DB: which migration chain is applied on https://cursor.neetrino.com ?
4. Are placeholder `owningUser` values in seed replaced with real Cursor dashboard IDs?
5. Is full `ADMIN_API_KEY` in Tampermonkey acceptable short-term, or block deploy until `IMPORT_API_KEY` exists?
6. Expected event volume per hour (drives pagination and summary query design)?

---

## Appendix A — API route inventory

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/tracker/health` | Tracker |
| POST | `/api/tracker/events` | Tracker |
| POST | `/api/cursor-usage/import` | Admin |
| POST | `/api/cursor-usage/sync-manual` | Admin or session |
| POST | `/api/matching/run` | Admin |
| GET | `/api/dashboard/summary` | Admin |
| GET | `/api/dashboard/events` | Admin |
| GET | `/api/dashboard/local-events` | Admin |

## Appendix B — Prisma models (present)

`CursorAccount`, `InternalUser`, `LocalAiEvent`, `CursorUsageEvent`, `SyncRun` — matches product spec.

## Appendix C — Matching algorithm (MVP)

- Filter locals: same `owningUser`, `|diff| <= MATCH_MAX_DIFF_MS`.
- Pick smallest diff; if second-best within `MATCH_AUTO_CONFIDENT_MS` of best → `low_confidence`.
- Greedy consumption of local rows (one usage → one local max).
