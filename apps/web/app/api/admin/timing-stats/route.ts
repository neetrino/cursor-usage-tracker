import { getPrisma } from '@/server/db';
import { isAdminAuthorized, unauthorizedAdminJson } from '@/server/admin-request-auth';
import { buildTimingStats } from '@/server/timing-stats';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  if (!isAdminAuthorized(req)) return unauthorizedAdminJson();

  const minutesRaw = new URL(req.url).searchParams.get('minutes') ?? '120';
  const minutes = Number(minutesRaw);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 24 * 60) : 120;

  const prisma = getPrisma();
  const stats = await buildTimingStats(prisma, safeMinutes);
  return jsonResponse(stats);
}
