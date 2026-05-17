import { isAdminAuthorized, unauthorizedAdminJson } from '@/server/admin-request-auth';
import { getHistoryCounts } from '@/server/clear-history';
import { getPrisma } from '@/server/db';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  if (!isAdminAuthorized(req)) {
    return unauthorizedAdminJson();
  }

  const counts = await getHistoryCounts(getPrisma());
  return jsonResponse({ ok: true, counts });
}
