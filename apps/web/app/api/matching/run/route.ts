import { prisma } from '@/server/db';
import { verifyAdminApiKey } from '@/server/auth';
import { runMatchingPass } from '@/server/matching/runMatching';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const key = req.headers.get('x-admin-api-key');
  if (!verifyAdminApiKey(key)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runMatchingPass(prisma);
  return jsonResponse(result);
}
