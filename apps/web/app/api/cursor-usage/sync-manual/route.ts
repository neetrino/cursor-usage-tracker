import { runManualCursorSync } from '@/server/cursor-usage-sync-manual';
import { getPrisma } from '@/server/db';
import { verifyAdminApiKey, verifyAdminSessionFromRequest } from '@/server/auth';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const key = req.headers.get('x-admin-api-key');
  const sessionOk = verifyAdminSessionFromRequest(req);
  if (!verifyAdminApiKey(key) && !sessionOk) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runManualCursorSync(getPrisma());
  return jsonResponse({
    importedCount: result.importedCount,
    skippedDuplicateCount: result.skippedDuplicateCount,
    ...(result.clientSyncRequired
      ? { clientSyncRequired: true, message: result.message }
      : {}),
  });
}
