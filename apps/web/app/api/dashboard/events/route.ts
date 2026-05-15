import { getPrisma } from '@/server/db';
import { verifyAdminApiKey } from '@/server/auth';
import { jsonResponse } from '@/server/http';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const key = req.headers.get('x-admin-api-key');
  if (!verifyAdminApiKey(key)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const prisma = getPrisma();
  const { searchParams } = new URL(req.url);
  const take = Math.min(Number(searchParams.get('limit') ?? '50') || 50, 200);
  const skip = Math.max(Number(searchParams.get('offset') ?? '0') || 0, 0);

  const owningUser = searchParams.get('owningUser') ?? undefined;
  const matchStatus = searchParams.get('matchStatus') ?? undefined;
  const userId = searchParams.get('userId') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: Prisma.CursorUsageEventWhereInput = {};
  if (owningUser) where.owningUser = owningUser;
  if (matchStatus) where.matchStatus = matchStatus;
  if (userId) where.matchedUserId = userId;
  if (from || to) {
    where.timestampUtc = {};
    if (from) where.timestampUtc.gte = new Date(from);
    if (to) where.timestampUtc.lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    prisma.cursorUsageEvent.findMany({
      where,
      orderBy: { timestampUtc: 'desc' },
      skip,
      take,
      include: {
        matchedUser: { select: { id: true, userKey: true, name: true } },
      },
    }),
    prisma.cursorUsageEvent.count({ where }),
  ]);

  return jsonResponse({
    total,
    items: rows.map((r) => ({
      id: r.id,
      timestampMs: r.timestampMs.toString(),
      timestampUtc: r.timestampUtc.toISOString(),
      owningUser: r.owningUser,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      totalTokens: r.totalTokens,
      chargedCents: r.chargedCents,
      matchedUser: r.matchedUser
        ? { id: r.matchedUser.id, userKey: r.matchedUser.userKey, name: r.matchedUser.name }
        : null,
      matchDiffMs: r.matchDiffMs,
      matchConfidence: r.matchConfidence,
      matchStatus: r.matchStatus,
    })),
  });
}
