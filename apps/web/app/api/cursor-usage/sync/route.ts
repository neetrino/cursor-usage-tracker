import { performCursorUsageSync } from '@/server/cursor-usage-sync';
import { verifyAdminApiKey } from '@/server/auth';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const key = req.headers.get('x-admin-api-key');
  if (!verifyAdminApiKey(key)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await performCursorUsageSync();
    return jsonResponse(result);
  } catch (e: unknown) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 400 });
  }
}
