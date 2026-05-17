import type { PrismaClient } from '@prisma/client';
import { importCursorUsageJson } from '@/server/cursor-usage-import';

const DEFAULT_CURSOR_USAGE_URL =
  'https://cursor.com/api/dashboard/get-filtered-usage-events';

const DEFAULT_LOOKBACK_MS = 60 * 60 * 1000;

export type ManualCursorSyncResult = {
  importedCount: number;
  skippedDuplicateCount: number;
  clientSyncRequired?: boolean;
  message?: string;
};

export async function runManualCursorSync(prisma: PrismaClient): Promise<ManualCursorSyncResult> {
  const lastRun = await prisma.syncRun.findFirst({
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  });

  const endMs = Date.now();
  const startMs = lastRun?.startedAt.getTime() ?? endMs - DEFAULT_LOOKBACK_MS;

  const headersJson = process.env.CURSOR_USAGE_HEADERS_JSON?.trim();
  if (!headersJson) {
    return clientSyncFallback();
  }

  let extraHeaders: Record<string, string>;
  try {
    const parsed: unknown = JSON.parse(headersJson);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return clientSyncFallback('Invalid CURSOR_USAGE_HEADERS_JSON');
    }
    extraHeaders = Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, String(v)]),
    );
  } catch {
    return clientSyncFallback('Invalid CURSOR_USAGE_HEADERS_JSON');
  }

  const apiUrl = process.env.CURSOR_USAGE_API_URL?.trim() || DEFAULT_CURSOR_USAGE_URL;
  const body = {
    teamId: 0,
    startDate: String(startMs),
    endDate: String(endMs),
    page: 1,
    pageSize: 100,
  };

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return clientSyncFallback();
    }

    const payload: unknown = await res.json();
    const result = await importCursorUsageJson({
      prisma,
      rawBody: payload,
      source: 'cursor_usage_api',
      runMatch: true,
    });

    return {
      importedCount: result.importedCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
    };
  } catch {
    return clientSyncFallback();
  }
}

function clientSyncFallback(message?: string): ManualCursorSyncResult {
  return {
    importedCount: 0,
    skippedDuplicateCount: 0,
    clientSyncRequired: true,
    message:
      message ??
      'Open cursor.com — Tampermonkey will sync automatically.',
  };
}
