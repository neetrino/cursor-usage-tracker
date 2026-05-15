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
  const userKey = searchParams.get('userKey') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: Prisma.LocalAiEventWhereInput = {};
  if (owningUser) where.owningUser = owningUser;
  if (userKey) where.userKey = userKey;
  if (from || to) {
    where.timestampUtc = {};
    if (from) where.timestampUtc.gte = new Date(from);
    if (to) where.timestampUtc.lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    prisma.localAiEvent.findMany({
      where,
      orderBy: { timestampUtc: 'desc' },
      skip,
      take,
    }),
    prisma.localAiEvent.count({ where }),
  ]);

  return jsonResponse({
    total,
    items: rows.map((r) => ({
      id: r.id,
      timestampMs: r.timestampMs.toString(),
      timestampUtc: r.timestampUtc.toISOString(),
      userKey: r.userKey,
      userName: r.userName,
      computerId: r.computerId,
      owningUser: r.owningUser,
      marker: r.marker,
      rawLineHash: r.rawLineHash,
    })),
  });
}
