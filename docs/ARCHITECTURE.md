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

1. Extension tails the selected Window log from the end (no historical replay on normal startup).
2. On marker detection, it parses the **log line timestamp** (not “now”).
3. It POSTs immediately to `POST /api/tracker/events` with `x-tracker-api-key`.
4. On failure, it appends to a JSON queue on disk and retries every 60 seconds; “Sync Now” flushes the queue.

### Flow C — Matching

1. For each usage row in `unmatched`, `unknown`, or `low_confidence` states, collect local candidates with same `owningUser` within `MATCH_MAX_DIFF_MS`.
2. Pick nearest by absolute diff.
3. If the second-best candidate is within `MATCH_AUTO_CONFIDENT_MS` of the best, mark `low_confidence`.
4. Greedy assignment processes usage rows in ascending time and marks a local row as consumed once matched (one-to-one MVP).

## Privacy and forbidden data

The system must never store or transmit:

- Prompt text
- Source code / file contents
- Cursor cookies or dashboard tokens

The extension stores only:

- Configuration (non-secret)
- `TRACKER_API_KEY` in VS Code Secret Storage
- A bounded pending queue of already-built JSON payloads (metadata + hashes)

## Security boundaries

- **Extension**: only `TRACKER_API_KEY`. Never Cursor dashboard credentials.
- **Server**: `CURSOR_USAGE_*` and `ADMIN_API_KEY` are process env only. Never `NEXT_PUBLIC_*` for secrets.
- **Dashboard auth (MVP)**: httpOnly cookie derived from `ADMIN_API_KEY` via server action login. Admin API routes remain for curl/testing with `x-admin-api-key`.

## Why SQLite for MVP

Small team, low volume, single VPS or local machine deployment. SQLite keeps ops simple. WAL mode and a busy timeout reduce lock friction for “web + worker + occasional concurrent reads”.

## Known limitations

- Concurrent AI usage on the same shared account can create ambiguous matches; the dashboard surfaces `low_confidence` and `unknown`.
- Log formats can change between Cursor versions; we provide a fallback marker to reduce single-point fragility.
- `owningUser` must match consistently between extension configuration and imported usage JSON.
