import { getPrisma } from '@/server/db';
import { resolveTrackerAuth } from '@/server/auth';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const prisma = getPrisma();
  const auth = await resolveTrackerAuth(req, prisma);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }
  return jsonResponse({
    ok: true,
    service: 'cursor-usage-tracker',
    time: new Date().toISOString(),
    auth: auth.kind,
  });
}
