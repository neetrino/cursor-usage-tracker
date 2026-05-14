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

## Phase 7 — Matching

- [x] Matcher + `POST /api/matching/run`

## Phase 8 — Dashboard

- [x] Summary + tables + settings + server actions

## Phase 9 — Extension

- [x] Commands + tail + markers + queue + VSIX packaging

## Phase 10 — Worker

- [x] 10 minute loop + `worker:once`

## Phase 11 — Final quality

- [x] Vitest coverage (shared + matcher)
- [x] README operational guide
