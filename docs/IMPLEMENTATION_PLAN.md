# Implementation plan (phased)

This document mirrors the execution order used to build the MVP.

## Phase 1 — Monorepo foundation

- pnpm workspace (`apps/web`, `apps/extension`, `apps/worker`, `packages/shared`)
- TypeScript configs (Next overrides `verbatimModuleSyntax` for bundler compatibility)
- Root scripts: `dev`, `build`, `test`, `db:*`, `worker`, `extension:*`

## Phase 2 — Documentation first

- `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/TESTING_PLAN.md`, `docs/PROGRESS.md`, `docs/BACKUP.md`
- `README.md` (operational guide)

## Phase 3 — Prisma + SQLite

- `apps/web/prisma/schema.prisma` with required models and indexes
- Initial migration + `prisma/seed.ts` (two placeholder accounts + sample users)
- WAL + busy timeout via `ensureSqlitePragmas()` (Next `instrumentation.ts` + shared Prisma client)

## Phase 4 — Shared package

- Zod schemas + exported types
- Hash + time + normalization helpers
- Dual build (CJS+ESM) for extension bundling

## Phase 5 — Cursor usage import API

- `POST /api/cursor-usage/import` (`x-admin-api-key`)
- `SyncRun` audit trail + dedupe on `rawHash`

## Phase 6 — Local tracker API

- `POST /api/tracker/events` (`x-tracker-api-key`)
- `InternalUser` resolution + `owningUser` consistency validation
- Dedupe on `rawLineHash`

## Phase 7 — Matching

- Pure `decideMatchForUsage` + transactional greedy pass
- `POST /api/matching/run`
- Env thresholds: `MATCH_MAX_DIFF_MS`, `MATCH_AUTO_CONFIDENT_MS`

## Phase 8 — Dashboard

- `/dashboard` summary
- `/dashboard/events`, `/dashboard/local-events` (filters via GET forms)
- `/dashboard/settings` (import JSON, sync, match, lists)
- Server Actions for admin operations (cookie session)

## Phase 9 — Extension

- Commands: Setup, Set Log Path, Test Detection, Show Pending, Sync Now
- Windows-first log discovery + manual override
- Immediate POST + 60s retry queue + polling tail safety net

## Phase 10 — Worker

- 10 minute loop: optional upstream sync + matching
- `pnpm worker:once` manual smoke

## Phase 11 — Quality + polish

- Vitest: `packages/shared` + `apps/web` matcher tests
- README limitations + backup guidance
