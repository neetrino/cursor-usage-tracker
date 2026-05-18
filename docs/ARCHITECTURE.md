# Cursor Usage Tracker — Architecture

## Purpose

Two shared Cursor Ultra accounts are used by six real people. Cursor’s usage API reports exact token usage and billing fields, but it does not identify which internal human used the shared account. This system correlates:

- **Exact usage rows** from Cursor (imported or synced server-side)
- **Local “AI started” signals** from each developer machine (VS Code extension tailing Cursor Window logs)

…using **timestamp proximity** under the same `owningUser`.

## Why Request ID is not used (MVP)

Request IDs would require deeper instrumentation and risk coupling to internal Cursor request lifecycle details. For MVP we intentionally avoid Request ID to reduce fragility and keep the extension surface minimal.

## Why Composer ID is not stored (MVP)

Composer identifiers can appear in logs, but MVP explicitly does **not** persist composer IDs. We only use coarse log markers and timestamps.

## Why timestamp matching is used

Both streams share:

- `owningUser` (Cursor account identity in usage JSON)
- A wall-time timestamp (usage: Unix ms from API; local: parsed from the Window log prefix in local timezone, converted to UTC)

When a developer triggers AI, Cursor writes a log line shortly before usage is attributed. The MVP matcher finds the closest `LocalAiEvent` within a configurable window.

## Data flows

### Flow A — Cursor usage ingestion

1. Admin imports JSON (`POST /api/cursor-usage/import`) or worker syncs (`CURSOR_USAGE_*` env).
2. Server normalizes rows, computes `rawHash`, dedupes on `rawHash`.
3. Optional matching pass runs after import/sync.

### Flow B — Local tracker

1. Extension auto-discovers the active `window*\renderer.log` under `%APPDATA%\Cursor\logs` (and re-runs discovery periodically / on rotation).
2. It tails from the end (no historical replay on first open of a path).
3. On `[buildRequestedModel]` only, it parses the **log line timestamp** (local timezone → UTC ms, not “now”).
4. It POSTs to `POST /api/tracker/events` with `Authorization: Bearer <deviceToken>` (per-device token from dashboard; legacy `x-tracker-api-key` optional for dev).
5. Backend dedupes by `rawLineHash` and `LOCAL_MARKER_DEDUPE_MS`; wakelock markers are ignored.
6. On failure, payloads queue on disk; retry every 60s; “Sync Now” flushes.

### Flow C — Matching

1. Skip usage rows with `totalTokens <= 0` → `ignored_zero_tokens` (no local consumption).
2. For remaining rows in `unmatched`, `unknown`, or `low_confidence`, use only `LocalAiEvent` rows with `marker = buildRequestedModel`.
3. Collect candidates with same `owningUser` within `MATCH_MAX_DIFF_MS` (default 3000ms).
4. Pick nearest by absolute diff; if second-best is within `MATCH_AUTO_CONFIDENT_MS` (default 500ms) of the best, mark `low_confidence`.
5. Greedy one-to-one assignment in ascending usage time.

## Privacy and forbidden data

The system must never store or transmit:

- Prompt text
- Source code / file contents
- Cursor cookies or dashboard tokens

The extension stores only:

- Configuration (non-secret)
- Per-device token in VS Code Secret Storage (hashed on server; raw token shown once at generation)
- A bounded pending queue of already-built JSON payloads (metadata + hashes)

## Security boundaries

- **Extension**: device token only (scoped to one `InternalUser`). No admin API key, no global tracker key in UI, no Cursor dashboard credentials.
- **Server**: `ADMIN_API_KEY` and optional `TRACKER_API_KEY` are process env only. Device tokens stored as SHA-256 hash in `DeviceToken` table.
- **Dashboard auth (MVP)**: httpOnly cookie derived from `ADMIN_API_KEY`. Admin routes also accept `x-admin-api-key` for curl.

## Why SQLite for MVP

Small team, low volume, single VPS or local machine deployment. SQLite keeps ops simple. WAL mode and a busy timeout reduce lock friction for “web + worker + occasional concurrent reads”.

## Known limitations

- Concurrent AI usage on the same shared account can create ambiguous matches; the dashboard surfaces `low_confidence` and `unknown`.
- Log formats can change between Cursor versions; we provide a fallback marker to reduce single-point fragility.
- `owningUser` must match consistently between extension configuration and imported usage JSON.
