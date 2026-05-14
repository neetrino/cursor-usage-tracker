# Testing plan

## Automated

- `pnpm test`
  - Shared: hashing stability + timestamp parsing smoke
  - Web: matcher decisions (nearest match, wrong owningUser isolation, low confidence ambiguity)

## Manual — Cursor usage JSON import

1. Set `ADMIN_API_KEY` in `.env`.
2. `curl -sS -H "x-admin-api-key: $ADMIN_API_KEY" -H "content-type: application/json" \
   -d @sample-usage.json http://localhost:3000/api/cursor-usage/import`
3. Expect: new `CursorUsageEvent` rows, duplicates skipped, `SyncRun` success row.

## Manual — Local tracker events

1. Set `TRACKER_API_KEY` in `.env`.
2. POST two events with different `rawLineHash`, repeat one hash.
3. Expect: two rows inserted, duplicate skipped.

## Manual — Matching scenario (spec)

- Usage `timestampMs = 1778774357470`, `owningUser = 289049274`
- Local `timestampMs = 1778774358082`, same owningUser
- Expect: `matched`, `matchDiffMs = 612`, confidence per piecewise function

## Manual — Wrong owningUser

- Local event with different `owningUser` than usage row
- Expect: no match (`unknown` after pass)

## Manual — Far timestamp

- Local event outside `MATCH_MAX_DIFF_MS`
- Expect: `unknown`

## Manual — Multiple candidates

- Two locals within window with similar diffs
- Expect: `low_confidence` when within `MATCH_AUTO_CONFIDENT_MS` gap rule

## Manual — Immediate send (extension)

1. Configure extension against dev server.
2. Trigger a real `[buildRequestedModel]` line (or use Test Log Detection on a captured log file).
3. Observe server logs/network: POST should happen immediately (not delayed by 60s).

## Manual — Offline retry (extension)

1. Stop web server.
2. Trigger marker detection (or enqueue by forcing failed POST).
3. Start web server, wait up to 60s or run “Sync Now”.
4. Expect queued events flush.

## Manual — Worker sync (optional)

1. Set `CURSOR_USAGE_SYNC_ENABLED=true` and valid `CURSOR_USAGE_API_URL` + `CURSOR_USAGE_HEADERS_JSON`.
2. Run `pnpm worker:once`.
3. Expect `SyncRun` row with source `cursor_usage_api` (or failure captured with error message).
