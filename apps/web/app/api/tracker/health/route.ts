import { verifyTrackerApiKey } from '@/server/auth';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const key = req.headers.get('x-tracker-api-key');
  if (!verifyTrackerApiKey(key)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }
  return jsonResponse({
    ok: true,
    service: 'cursor-usage-tracker',
    time: new Date().toISOString(),
  });
}
