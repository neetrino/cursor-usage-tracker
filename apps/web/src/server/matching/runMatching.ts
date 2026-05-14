import { calculateDiffMs, matchConfidenceFromDiffMs } from '@cursor-usage-tracker/shared';
import type { CursorUsageEvent, LocalAiEvent, PrismaClient } from '@prisma/client';

export type MatchingEnv = {
  maxDiffMs: number;
  autoConfidentMs: number;
};

export function readMatchingEnv(): MatchingEnv {
  const maxDiffMs = Number(process.env.MATCH_MAX_DIFF_MS ?? '3000');
  const autoConfidentMs = Number(process.env.MATCH_AUTO_CONFIDENT_MS ?? '1000');
  return {
    maxDiffMs: Number.isFinite(maxDiffMs) ? maxDiffMs : 3000,
    autoConfidentMs: Number.isFinite(autoConfidentMs) ? autoConfidentMs : 1000,
  };
}

type LocalRow = Pick<LocalAiEvent, 'id' | 'owningUser' | 'timestampMs' | 'userId'>;

export type MatchDecision =
  | {
      status: 'matched';
      matchedLocalEventId: string;
      matchedUserId: string | null;
      matchDiffMs: number;
      matchConfidence: number;
    }
  | {
      status: 'low_confidence';
      matchedLocalEventId: string;
      matchedUserId: string | null;
      matchDiffMs: number;
      matchConfidence: number;
    }
  | { status: 'unknown' };

export function decideMatchForUsage(params: {
  usage: Pick<CursorUsageEvent, 'timestampMs' | 'owningUser'>;
  locals: LocalRow[];
  env: MatchingEnv;
}): MatchDecision {
  const { usage, locals, env } = params;
  const cursorMs = usage.timestampMs;
  const sameOwner = locals.filter((l) => l.owningUser === usage.owningUser);
  const candidates = sameOwner
    .map((l) => ({
      local: l,
      diff: calculateDiffMs(cursorMs, l.timestampMs),
    }))
    .filter((c) => c.diff <= env.maxDiffMs)
    .sort((a, b) => a.diff - b.diff);

  if (candidates.length === 0) {
    return { status: 'unknown' };
  }

  const first = candidates[0];
  const second = candidates[1];
  const firstDiff = first.diff;
  const secondDiff = second?.diff ?? Number.POSITIVE_INFINITY;
  const ambiguous = second !== undefined && secondDiff - firstDiff < env.autoConfidentMs;

  const matchConfidence = matchConfidenceFromDiffMs(firstDiff);
  const base = {
    matchedLocalEventId: first.local.id,
    matchedUserId: first.local.userId,
    matchDiffMs: firstDiff,
    matchConfidence,
  };

  if (ambiguous) {
    return { status: 'low_confidence', ...base };
  }
  return { status: 'matched', ...base };
}

export async function runMatchingPass(prisma: PrismaClient): Promise<{ updated: number }> {
  const env = readMatchingEnv();
  const pending = await prisma.cursorUsageEvent.findMany({
    where: { matchStatus: { in: ['unmatched', 'unknown', 'low_confidence'] } },
    orderBy: { timestampMs: 'asc' },
    select: {
      id: true,
      owningUser: true,
      timestampMs: true,
      matchStatus: true,
    },
  });

  const locals = await prisma.localAiEvent.findMany({
    select: { id: true, owningUser: true, timestampMs: true, userId: true },
  });

  const consumedLocals = new Set<string>();
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const usage of pending) {
      const availableLocals = locals.filter((l) => !consumedLocals.has(l.id));
      const decision = decideMatchForUsage({ usage, locals: availableLocals, env });

      if (decision.status === 'unknown') {
        await tx.cursorUsageEvent.update({
          where: { id: usage.id },
          data: {
            matchStatus: 'unknown',
            matchedUserId: null,
            matchedLocalEventId: null,
            matchDiffMs: null,
            matchConfidence: null,
          },
        });
        updated += 1;
        continue;
      }

      consumedLocals.add(decision.matchedLocalEventId);
      await tx.cursorUsageEvent.update({
        where: { id: usage.id },
        data: {
          matchStatus: decision.status,
          matchedUserId: decision.matchedUserId,
          matchedLocalEventId: decision.matchedLocalEventId,
          matchDiffMs: decision.matchDiffMs,
          matchConfidence: decision.matchConfidence,
        },
      });
      updated += 1;
    }
  });

  return { updated };
}
