import { isAdminAuthorized, unauthorizedAdminJson } from '@/server/admin-request-auth';
import { CLEAR_HISTORY_CONFIRMATION, clearAllHistory } from '@/server/clear-history';
import { getPrisma } from '@/server/db';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

type ClearHistoryBody = {
  confirmation?: string;
};

export async function POST(req: Request): Promise<Response> {
  if (!isAdminAuthorized(req)) {
    return unauthorizedAdminJson();
  }

  let body: ClearHistoryBody;
  try {
    body = (await req.json()) as ClearHistoryBody;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid confirmation' }, { status: 400 });
  }

  if (body.confirmation !== CLEAR_HISTORY_CONFIRMATION) {
    return jsonResponse({ ok: false, error: 'Invalid confirmation' }, { status: 400 });
  }

  const deleted = await clearAllHistory(getPrisma());
  return jsonResponse({
    ok: true,
    deleted: {
      localEvents: deleted.localEvents,
      cursorUsageEvents: deleted.cursorUsageEvents,
      syncRuns: deleted.syncRuns,
    },
  });
}
