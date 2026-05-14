import { buildDashboardSummary } from '@/server/dashboard-summary';
import { verifyAdminApiKey } from '@/server/auth';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const key = req.headers.get('x-admin-api-key');
  if (!verifyAdminApiKey(key)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const summary = await buildDashboardSummary();
  return jsonResponse(summary);
}
