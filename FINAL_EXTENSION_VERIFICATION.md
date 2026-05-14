# Cursor Usage Tracker — final extension verification

## Package version

- **Extension:** `0.0.5` (`apps/extension/package.json` → `"version": "0.0.5"`)

## Source verification (2026-05-15)

| Check | Result |
|--------|--------|
| `packages/shared/src/time.ts` — Luxon in `parseCursorLocalLogTimestampToMs` | **None.** Parser uses regex capture + `new Date(y, mo - 1, d, h, mi, s, ms)` + `Number.isFinite(time)` + `BigInt(time)`. |
| `apps/extension/src/extension.ts` — `processLine` non-string guard | **Present.** `if (typeof line !== 'string') { debugTrace(...); return; }` before `detectMarker` / payload. |
| `apps/extension/src/debugTrace.ts` | **Present.** Opt-in when `process.env.CURSOR_USAGE_TRACKER_DEBUG === '1'`. Output channel: **Cursor Usage Tracker (Debug)**. |

## Build commands used (clean + rebuild + package)

From repository root (`c:\AI\cursor-token-usage`):

```powershell
if (Test-Path apps/extension/out) { Remove-Item -Recurse -Force apps/extension/out }
pnpm --filter @cursor-usage-tracker/shared build
pnpm extension:build
pnpm extension:package
```

Equivalent: shared is built twice when using `extension:build` (root script already builds shared first); the explicit shared build ensures a clean `packages/shared/dist` before the extension bundle.

## VSIX artifact

- **Filename:** `apps/extension/cursor-usage-tracker-extension-0.0.5.vsix`
- **Packaged path (vsce output):** `C:\AI\cursor-token-usage\apps\extension\cursor-usage-tracker-extension-0.0.5.vsix`

## Bundled `extension.js` checks

- **Luxon / `DateTime.fromFormat` for log timestamps:** **Not present.** A search for the substring `luxon` in `apps/extension/out/extension.js` returns no matches.
- **Native log timestamp path:** **Present** (e.g. bundled code includes `Invalid local datetime parsed from line` and `const date = new Date(` in the shared time helper region).
- **Note:** The bundle still includes **Zod**, which has its own string `datetime` / `date` helpers (unrelated to the removed Luxon log-line parser). That is expected from the shared package barrel export and is not used for Cursor window log timestamp parsing.

## Debug logs (optional)

1. Start Cursor with environment variable **`CURSOR_USAGE_TRACKER_DEBUG=1`** (OS-specific: Windows shortcut, shell launch, or system env).
2. **View → Output**, select channel **Cursor Usage Tracker (Debug)**.
3. Traces omit secrets and full log line bodies; they include scopes such as `activate`, `tailOnce:lines`, `testLogDetection:enter`, `command:testLogDetection`, and `processLine:invalidLine` (only if a non-string line is seen).

## Manual test steps inside Cursor

1. **Install VSIX:** Extensions → `...` → **Install from VSIX…** → choose `apps/extension/cursor-usage-tracker-extension-0.0.5.vsix`.
2. **Restart Cursor** (or **Developer: Reload Window**) so the new version loads.
3. **Test Log Detection:** Command Palette → **Cursor Usage Tracker: Test Log Detection** (ensure a log path is configured or discoverable on Windows under `%APPDATA%\Cursor\logs` if using discovery).
4. **Output channels:** Optionally confirm **Cursor Usage Tracker (Debug)** only if `CURSOR_USAGE_TRACKER_DEBUG=1` was set; otherwise no debug channel activity is expected.
5. **Regression:** Confirm **no** error: `Cannot read properties of undefined (reading 'includes')` during activation, settings, backend test, or Test Log Detection.

## Acceptance summary

| Item | Status |
|------|--------|
| Luxon-based **log line** timestamp parsing | **Removed** from shared time + bundle |
| `processLine` guards non-string lines | **Yes** |
| Debug logging | **Opt-in** via `CURSOR_USAGE_TRACKER_DEBUG=1` |
| VSIX version in filename | **0.0.5** |
