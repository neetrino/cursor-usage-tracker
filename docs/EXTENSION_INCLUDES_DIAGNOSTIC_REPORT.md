# Extension `.includes` and runtime diagnostic report

This document is a **static** inventory of `.includes(` usage and **runtime** instructions for capturing a full stack trace. It does not substitute for one real failing run: the exact file/line/variable for a given crash must be read from **`[STACK]`** in the Diagnostics output after the error occurs.

## 1. Repository search summary

| Pattern | `apps/extension/src` | `packages/shared/src` | Notes |
|--------|------------------------|------------------------|--------|
| `.includes(` | 4 (see table below) | 0 | Shared has no direct `.includes`. |
| `localeStr` | 0 | 0 | Not present in source. |
| `fromFormat` / `DateTime` (Luxon) | 0 | 0 | Removed from shared time parsing. |
| `safeParse` / schema `.parse` | 0 | 0 | Extension source does not call Zod parsers. |

Regenerate `apps/extension/out/extension.js` with `pnpm --filter cursor-usage-tracker-extension build` before using bundle line numbers below.

## 2. Table: every `.includes(` in extension **source**

| File | Line | Snippet | Receiver of `.includes` | Expected type | Can be `undefined`? | When it runs |
|------|------|---------|-------------------------|---------------|---------------------|----------------|
| `apps/extension/src/markers.ts` | 7 | `line.includes(PRIMARY_MARKER)` | `line` | `string` | No (guarded by `typeof line === 'string' && line.length > 0` on line 5) | Marker detection during tail / log test |
| `apps/extension/src/markers.ts` | 8 | `line.includes(WAKELOCK_…)` ×2 | `line` | `string` | Same | Same |
| `apps/extension/src/logDiscovery.ts` | 99–100 | `asString(a.path).toLowerCase().includes('renderer.log')` | **string** returned by `toLowerCase()` | `string` | No (`asString` always returns `string`) | `discoverCursorLogFiles` sort (discovery / settings auto-discover) |

## 3. Table: `.includes(` in **bundled** `apps/extension/out/extension.js` (representative)

After build, ripgrep-style scan found **8** occurrences. Important ones:

| Bundle line (approx.) | Origin | Receiver | Undefined risk |
|----------------------|--------|----------|------------------|
| ~4239–4240 | `markers.ts` | `line` | Low (same guard as source) |
| ~4401–4402 | `logDiscovery.ts` | result of `toLowerCase()` on `asString(path)` | Low |
| ~1232 | **Zod** (`z.string()` refinement `includes`) | `input.data` | **Medium if** Zod string check runs with malformed pipeline; extension does not call these parsers in current code paths |
| ~783 | Bundled helper | `err?.message` optional chain | Low |

There is **no** `luxon` substring in the bundle; **`parseCursorLocalLogTimestampToMs`** is inlined as native `Date` + regex (see shared `time.ts`).

## 4. Runtime: full stack trace capture

### Output channel

- **Name:** `Cursor Usage Tracker (Diagnostics)`
- **Behavior:** On thrown errors in instrumented scopes, the extension appends **`[ERROR]`** (message) and **`[STACK]`** (full stack) and **rethrows** (where applicable).

### Instrumented scopes

- `activate` (outer try/catch)
- `activate:startWatchers`
- `startWatchers`
- `tailOnce` + `tailOnce:poll` + `tailOnce:onDidChange`
- `flushPendingQueue:interval`
- `processLine` (outer try/catch after non-string guard)
- `buildPayload` (includes `parseCursorLocalLogTimestampToMs` path)
- Commands: `openSettings`, `setup`, `setLogPath`, `testLogDetection`, `showPending`, `syncNow`
- `testLogDetection` (catch logs then returns `{ ok: false, reason }` — stack is preserved in Diagnostics **before** user-facing reason)
- `handleSettingsWebviewMessage:<type>` (settings webview message handler)

### How to read the crash precisely

1. **View → Output** → select **Cursor Usage Tracker (Diagnostics)**.
2. Reproduce the failure (e.g. **Test Log Detection**, or wait for tail poll).
3. Find the latest `---` block: **`scope=...`** identifies the entry point.
4. From **`[STACK]`**, read the **top frame** (crash site) and follow **source maps** (`extension.js.map`) if you need the original `.ts` line.

### Interpreting `Cannot read properties of undefined (reading 'includes')`

- The **undefined** value is whatever appears **to the left** of `.includes` in the **top stack frame** (e.g. `input.data` in Zod, or a historical third-party `localeStr` in Luxon if an old VSIX were still installed).
- **Do not** infer the receiver from the error text alone; use the stack frame.

## 5. Runtime paths that previously led to Luxon `includes` (historical)

| Path | Steps |
|------|--------|
| Tail / marker | `activate` → `startWatchers` → `tailOnce` → `processLine` → `buildPayload` → `parseCursorLocalLogTimestampToMs(line)` |
| Test command | `command:testLogDetection` → `testLogDetection` → `parseCursorLocalLogTimestampToMs(lineStr)` |

Current shared implementation uses **native `Date`**, not Luxon.

## 6. Source map

Source maps are emitted as **`apps/extension/out/extension.js.map`**. Use your editor or `npx source-map-cli` against the **`[STACK]`** frame’s line/column in `extension.js` to map back to **`extension.ts`** / **`logDiscovery.ts`** / **`markers.ts`**.
