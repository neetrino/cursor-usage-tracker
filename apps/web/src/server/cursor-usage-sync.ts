import { cursorUsageImportSchema } from '@cursor-usage-tracker/shared/schemas';
import { importCursorUsageJson } from './cursor-usage-import';
import { getPrisma } from './db';
import { getRequiredEnv } from './env';

export async function performCursorUsageSync(): Promise<{
  ok: true;
  importedCount: number;
  skippedDuplicateCount: number;
  syncRunId: string;
}> {
  const enabled = (process.env.CURSOR_USAGE_SYNC_ENABLED ?? 'false').toLowerCase() === 'true';
  if (!enabled) {
    throw new Error('CURSOR_USAGE_SYNC_ENABLED is not true');
  }

  const url = getRequiredEnv('CURSOR_USAGE_API_URL');

  const headersJson = process.env.CURSOR_USAGE_HEADERS_JSON;
  let headers: Record<string, string> = { accept: 'application/json' };
  if (headersJson) {
    const parsed = JSON.parse(headersJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('CURSOR_USAGE_HEADERS_JSON must be a JSON object');
    }
    headers = { ...headers, ...(parsed as Record<string, string>) };
  }

  const res = await fetch(url, { headers, method: 'GET' });
  if (!res.ok) {
    throw new Error(`Upstream fetch failed: HTTP ${res.status}`);
  }

  const body: unknown = await res.json();
  const parsedBody = cursorUsageImportSchema.parse(body);

  const result = await importCursorUsageJson({
    prisma: getPrisma(),
    rawBody: parsedBody,
    source: 'cursor_usage_api',
    runMatch: true,
  });

  return { ok: true, ...result };
}
