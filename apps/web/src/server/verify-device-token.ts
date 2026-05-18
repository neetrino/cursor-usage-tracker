import type { InternalUser, PrismaClient } from '@prisma/client';
import { hashDeviceToken } from '@/server/device-token';

export type VerifiedDeviceToken = {
  deviceTokenId: string;
  internalUser: InternalUser & { cursorAccount: { owningUser: string } };
  computerId: string;
  owningUser: string;
};

export async function verifyDeviceToken(
  prisma: PrismaClient,
  rawToken: string,
): Promise<VerifiedDeviceToken | null> {
  const tokenHash = hashDeviceToken(rawToken);
  const row = await prisma.deviceToken.findUnique({
    where: { tokenHash },
    include: {
      internalUser: { include: { cursorAccount: true } },
    },
  });
  if (!row || !row.isActive || row.revokedAt) return null;
  if (!row.internalUser.isActive) return null;

  await prisma.deviceToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    deviceTokenId: row.id,
    internalUser: row.internalUser,
    computerId: row.computerId,
    owningUser: row.owningUser,
  };
}
