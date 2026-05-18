import { z } from 'zod';
import { getPrisma } from '@/server/db';
import { isAdminAuthorized, unauthorizedAdminJson } from '@/server/admin-request-auth';
import { generateDeviceToken } from '@/server/device-token';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

const createBodySchema = z.object({
  internalUserId: z.string().min(1),
});

export async function GET(req: Request): Promise<Response> {
  if (!isAdminAuthorized(req)) return unauthorizedAdminJson();

  const internalUserId = new URL(req.url).searchParams.get('internalUserId')?.trim();
  if (!internalUserId) {
    return jsonResponse({ error: 'internalUserId is required' }, { status: 400 });
  }

  const prisma = getPrisma();
  const tokens = await prisma.deviceToken.findMany({
    where: { internalUserId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tokenPrefix: true,
      tokenLast4: true,
      computerId: true,
      owningUser: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      revokedAt: true,
    },
  });

  return jsonResponse({ tokens });
}

export async function POST(req: Request): Promise<Response> {
  if (!isAdminAuthorized(req)) return unauthorizedAdminJson();

  const body: unknown = await req.json();
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.flatten() }, { status: 400 });
  }

  const prisma = getPrisma();
  const user = await prisma.internalUser.findUnique({
    where: { id: parsed.data.internalUserId },
    include: { cursorAccount: true },
  });
  if (!user) {
    return jsonResponse({ error: 'Internal user not found' }, { status: 404 });
  }

  const generated = generateDeviceToken();
  const row = await prisma.deviceToken.create({
    data: {
      internalUserId: user.id,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      tokenLast4: generated.tokenLast4,
      computerId: user.computerId,
      owningUser: user.cursorAccount.owningUser,
    },
  });

  return jsonResponse({
    id: row.id,
    rawToken: generated.rawToken,
    tokenPrefix: generated.tokenPrefix,
    tokenLast4: generated.tokenLast4,
    computerId: row.computerId,
    owningUser: row.owningUser,
    message: 'Copy this token now. It will not be shown again.',
  });
}
