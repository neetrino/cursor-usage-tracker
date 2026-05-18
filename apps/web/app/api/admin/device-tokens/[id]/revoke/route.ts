import { getPrisma } from '@/server/db';
import { isAdminAuthorized, unauthorizedAdminJson } from '@/server/admin-request-auth';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!isAdminAuthorized(_req)) return unauthorizedAdminJson();

  const { id } = await ctx.params;
  const prisma = getPrisma();
  const existing = await prisma.deviceToken.findUnique({ where: { id } });
  if (!existing) {
    return jsonResponse({ error: 'Device token not found' }, { status: 404 });
  }

  await prisma.deviceToken.update({
    where: { id },
    data: { isActive: false, revokedAt: new Date() },
  });

  return jsonResponse({ ok: true });
}
