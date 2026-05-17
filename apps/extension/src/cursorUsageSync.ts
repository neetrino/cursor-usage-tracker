import {
  cursorUsageImportSchema,
  type CursorUsageImportPayload,
} from '@cursor-usage-tracker/shared/schemas';
import type * as vscode from 'vscode';
import { postCursorUsageImport } from './backendClient';
import { csvToUsageEvents } from './cursorUsageCsv';
import {
  getAdminApiKey,
  loadPublicSettings,
  setLastCursorUsageSync,
  type LastCursorUsageSyncStatus,
} from './config';
import { asString, isNonEmptyString } from './stringUtil';
import { debugTrace } from './debugTrace';
import { logDiagnosticError } from './diagnosticChannel';

export const CURSOR_USAGE_SYNC_INTERVAL_MS = 10 * 60 * 1000;
export const CURSOR_USAGE_CSV_URL =
  'https://cursor.com/api/dashboard/export-usage-events-csv';
const LOOKBACK_MS = CURSOR_USAGE_SYNC_INTERVAL_MS;

export type CursorUsageSyncResult =
  | {
      ok: true;
      eventCount: number;
      importedCount: number;
      skippedDuplicateCount: number;
    }
  | { ok: false; reason: string };

function buildExportUrl(startMs: number, endMs: number): string {
  const params = new URLSearchParams({
    startDate: String(startMs),
    endDate: String(endMs),
    strategy: 'tokens',
  });
  return `${CURSOR_USAGE_CSV_URL}?${params.toString()}`;
}

async function fetchUsageCsv(startMs: number, endMs: number): Promise<string> {
  const url = buildExportUrl(startMs, endMs);
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { accept: 'text/csv, text/plain, */*' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cursor CSV export failed: HTTP ${res.status} ${text}`.trim());
  }
  return res.text();
}

export async function syncCursorUsage(context: vscode.ExtensionContext): Promise<CursorUsageSyncResult> {
  const settings = loadPublicSettings(context);
  const baseUrl = asString(settings.backendUrl).trim().replace(/\/+$/, '');
  const owningUser = asString(settings.owningUser).trim();
  const adminApiKey = await getAdminApiKey(context);

  if (!isNonEmptyString(baseUrl) || !adminApiKey) {
    return { ok: false, reason: 'Missing backendUrl or admin API key (open Settings).' };
  }
  if (!isNonEmptyString(owningUser)) {
    return { ok: false, reason: 'Missing owningUser in settings.' };
  }

  const endMs = Date.now();
  const startMs = endMs - LOOKBACK_MS;

  try {
    debugTrace('syncCursorUsage:start', { startMs, endMs, owningUserLen: owningUser.length });

    const csv = await fetchUsageCsv(startMs, endMs);
    const usageEventsDisplay = csvToUsageEvents(csv, owningUser);

    if (usageEventsDisplay.length === 0) {
      const status: LastCursorUsageSyncStatus = {
        ok: true,
        message: 'No usage events in CSV window',
        atIso: new Date().toISOString(),
        eventCount: 0,
        importedCount: 0,
        skippedDuplicateCount: 0,
      };
      await setLastCursorUsageSync(context, status);
      return {
        ok: true,
        eventCount: 0,
        importedCount: 0,
        skippedDuplicateCount: 0,
      };
    }

    const payload: CursorUsageImportPayload = {
      totalUsageEventsCount: usageEventsDisplay.length,
      usageEventsDisplay,
    };
    cursorUsageImportSchema.parse(payload);

    const importResult = await postCursorUsageImport({
      baseUrl,
      adminApiKey,
      payload,
    });

    const status: LastCursorUsageSyncStatus = {
      ok: true,
      message: `Imported ${importResult.importedCount}, skipped ${importResult.skippedDuplicateCount}`,
      atIso: new Date().toISOString(),
      eventCount: usageEventsDisplay.length,
      importedCount: importResult.importedCount,
      skippedDuplicateCount: importResult.skippedDuplicateCount,
    };
    await setLastCursorUsageSync(context, status);

    return {
      ok: true,
      eventCount: usageEventsDisplay.length,
      importedCount: importResult.importedCount,
      skippedDuplicateCount: importResult.skippedDuplicateCount,
    };
  } catch (e) {
    logDiagnosticError('syncCursorUsage', e);
    const message = e instanceof Error ? e.message : String(e);
    await setLastCursorUsageSync(context, {
      ok: false,
      message,
      atIso: new Date().toISOString(),
      eventCount: 0,
      importedCount: 0,
      skippedDuplicateCount: 0,
    });
    return { ok: false, reason: message };
  }
}
