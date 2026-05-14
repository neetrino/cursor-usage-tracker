# Progress checklist

## Phase 1 — Monorepo foundation

- [x] pnpm workspace scaffold
- [x] `apps/web` Next.js app
- [x] `apps/extension` VS Code extension scaffold + esbuild bundle
- [x] `apps/worker` scheduled runner
- [x] `packages/shared` dual build

## Phase 2 — Documentation

- [x] `docs/ARCHITECTURE.md`
- [x] `docs/IMPLEMENTATION_PLAN.md`
- [x] `docs/TESTING_PLAN.md`
- [x] `docs/PROGRESS.md`
- [x] `docs/BACKUP.md`

## Phase 3 — Prisma SQLite

- [x] Schema + migration + seed
- [x] WAL + busy timeout helper

## Phase 4 — Shared package

- [x] Zod + types + helpers

## Phase 5 — Usage import API

- [x] `POST /api/cursor-usage/import`

## Phase 6 — Tracker API

- [x] `POST /api/tracker/events`
- [x] `GET /api/tracker/health` (lightweight auth check for extension settings UI)

## Phase 7 — Matching

- [x] Matcher + `POST /api/matching/run`

## Phase 8 — Dashboard

- [x] Summary + tables + settings + server actions

## Phase 9 — Extension

- [x] Commands + tail + markers + queue + VSIX packaging
- [x] Webview **Open Settings** panel (single-place config, SecretStorage for tracker key, globalState for other fields, status + queue actions)

## Phase 10 — Worker

- [x] 10 minute loop + `worker:once`

## Phase 11 — Final quality

- [x] Vitest coverage (shared + matcher)
- [x] README operational guide

## Post-MVP fixes (extension webview)

- [x] **Save / webview payloads**: Central `asString` / `isNonEmptyString` helpers; normalize all form fields before validation or storage; `cursorLogPath` optional on Save; split `cursorAccountGroup` + `customCursorAccountGroup`; hardened backend URL and path handling so webview Save never throws on undefined fields.

## Post-MVP fixes (startup)

- [x] **Next.js env loading**: Removed `apps/web/src/env-bootstrap.ts` and `dotenv` from `apps/web`. Next.js loads `.env` / `.env.local` automatically; `dotenv` remains only in `apps/worker` for CLI processes.
- [x] **SQLite PRAGMAs**: Switched WAL and `busy_timeout` from `$executeRawUnsafe` to `$queryRawUnsafe` (PRAGMA returns rows). Wrapped in try/catch: failure logs a warning and does not block startup.
