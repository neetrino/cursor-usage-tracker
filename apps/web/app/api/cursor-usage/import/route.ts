import { importCursorUsageJson } from '@/server/cursor-usage-import';
import { getPrisma } from '@/server/db';
import { verifyAdminApiKey } from '@/server/auth';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const key = req.headers.get('x-admin-api-key');
  if (!verifyAdminApiKey(key)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const result = await importCursorUsageJson({
    prisma: getPrisma(),
    rawBody: body,
    source: 'manual_import',
    runMatch: true,
  });

  return jsonResponse(result);
}
