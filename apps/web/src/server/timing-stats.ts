import type { PrismaClient } from '@prisma/client';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))] ?? 0;
}

export type TimingStatsResponse = {
  minutes: number;
  count: number;
  averageAbsDiffMs: number;
  minAbsDiffMs: number;
  maxAbsDiffMs: number;
  p50AbsDiffMs: number;
  p90AbsDiffMs: number;
  p95AbsDiffMs: number;
  under100ms: { count: number; percent: number };
  under300ms: { count: number; percent: number };
  under500ms: { count: number; percent: number };
  under1000ms: { count: number; percent: number };
  over3000ms: { count: number; percent: number };
  latest: Array<{
    cursorUsageTimestampUtc: string;
    localEventTimestampUtc: string;
    marker: string;
    signedDiffMs: number;
    absDiffMs: number;
    model: string;
    totalTokens: number;
    owningUser: string;
    matchedUserKey: string | null;
    matchedUserName: string | null;
  }>;
};

export async function buildTimingStats(
  prisma: PrismaClient,
  minutes: number,
): Promise<TimingStatsResponse> {
  const since = new Date(Date.now() - minutes * 60_000);
  const rows = await prisma.cursorUsageEvent.findMany({
    where: {
      matchStatus: { in: ['matched', 'low_confidence'] },
      matchDiffMs: { not: null },
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
    select: {
      timestampUtc: true,
      timestampMs: true,
      owningUser: true,
      model: true,
      totalTokens: true,
      matchDiffMs: true,
      matchedUser: { select: { userKey: true, name: true } },
      matchedLocalEvent: {
        select: { timestampUtc: true, timestampMs: true, marker: true },
      },
    },
  });

  const diffs = rows
    .map((r) => r.matchDiffMs)
    .filter((d): d is number => typeof d === 'number');
  const sorted = [...diffs].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);

  const bucket = (threshold: number): { count: number; percent: number } => {
    const c = sorted.filter((d) => d <= threshold).length;
    return { count: c, percent: count === 0 ? 0 : Math.round((c / count) * 1000) / 10 };
  };

  const over3000 = sorted.filter((d) => d > 3000).length;

  const latest = rows.slice(0, 100).map((r) => {
    const localUtc = r.matchedLocalEvent?.timestampUtc?.toISOString() ?? '';
    const signed = r.matchedLocalEvent
      ? Number(r.timestampMs) - Number(r.matchedLocalEvent.timestampMs)
      : 0;
    return {
      cursorUsageTimestampUtc: r.timestampUtc.toISOString(),
      localEventTimestampUtc: localUtc,
      marker: r.matchedLocalEvent?.marker ?? '',
      signedDiffMs: signed,
      absDiffMs: r.matchDiffMs ?? 0,
      model: r.model,
      totalTokens: r.totalTokens,
      owningUser: r.owningUser,
      matchedUserKey: r.matchedUser?.userKey ?? null,
      matchedUserName: r.matchedUser?.name ?? null,
    };
  });

  return {
    minutes,
    count,
    averageAbsDiffMs: count === 0 ? 0 : Math.round(sum / count),
    minAbsDiffMs: sorted[0] ?? 0,
    maxAbsDiffMs: sorted[sorted.length - 1] ?? 0,
    p50AbsDiffMs: percentile(sorted, 50),
    p90AbsDiffMs: percentile(sorted, 90),
    p95AbsDiffMs: percentile(sorted, 95),
    under100ms: bucket(100),
    under300ms: bucket(300),
    under500ms: bucket(500),
    under1000ms: bucket(1000),
    over3000ms: {
      count: over3000,
      percent: count === 0 ? 0 : Math.round((over3000 / count) * 1000) / 10,
    },
    latest,
  };
}
