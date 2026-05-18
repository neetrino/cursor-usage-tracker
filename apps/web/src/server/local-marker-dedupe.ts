import type { PrismaClient } from '@prisma/client';

export function readLocalMarkerDedupeMs(): number {
  const raw = Number(process.env.LOCAL_MARKER_DEDUPE_MS ?? '3000');
  return Number.isFinite(raw) && raw >= 0 ? raw : 3000;
}

export async function shouldSkipLocalMarkerInsert(params: {
  prisma: PrismaClient;
  marker: string;
  userKey: string;
  computerId: string;
  owningUser: string;
  timestampMs: bigint;
  dedupeMs: number;
}): Promise<boolean> {
  const { prisma, marker, userKey, computerId, owningUser, timestampMs, dedupeMs } = params;
  if (dedupeMs <= 0) return false;

  if (marker === 'wakelock_acquired') {
    const buildNearby = await prisma.localAiEvent.findFirst({
      where: {
        userKey,
        computerId,
        owningUser,
        marker: 'buildRequestedModel',
        timestampMs: {
          gte: timestampMs - BigInt(dedupeMs),
          lte: timestampMs + BigInt(dedupeMs),
        },
      },
    });
    if (buildNearby) return true;
    return false;
  }

  const nearby = await prisma.localAiEvent.findFirst({
    where: {
      userKey,
      computerId,
      owningUser,
      timestampMs: {
        gte: timestampMs - BigInt(dedupeMs),
        lte: timestampMs + BigInt(dedupeMs),
      },
    },
  });
  return nearby !== null;
}
