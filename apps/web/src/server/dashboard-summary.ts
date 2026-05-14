import { prisma } from '@/server/db';
import type { DashboardSummary } from '@cursor-usage-tracker/shared';

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export async function buildDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const weekStart = addUtcDays(todayStart, -6);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const usage = await prisma.cursorUsageEvent.findMany({
    select: {
      id: true,
      timestampUtc: true,
      owningUser: true,
      model: true,
      totalTokens: true,
      chargedCents: true,
      matchStatus: true,
      matchedUserId: true,
      matchedUser: { select: { name: true } },
    },
  });

  const sumTokens = (rows: typeof usage): number =>
    rows.reduce((acc, r) => acc + r.totalTokens, 0);

  const inRange = (rows: typeof usage, start: Date): typeof usage =>
    rows.filter((r) => r.timestampUtc >= start);

  const todayRows = inRange(usage, todayStart);
  const weekRows = inRange(usage, weekStart);
  const monthRows = inRange(usage, monthStart);

  const chargedCents = usage.reduce((acc, r) => acc + (r.chargedCents ?? 0), 0);

  const unknownCount = usage.filter((r) => r.matchStatus === 'unknown').length;
  const lowConfidenceCount = usage.filter((r) => r.matchStatus === 'low_confidence').length;
  const unmatchedCount = usage.filter((r) => r.matchStatus === 'unmatched').length;

  const matchedUserIds = [...new Set(usage.map((u) => u.matchedUserId).filter(Boolean))] as string[];
  const users = await prisma.internalUser.findMany({
    where: { id: { in: matchedUserIds } },
    select: { id: true, userKey: true, name: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const byUserMap = new Map<string, { userId: string; userKey: string; name: string; totalTokens: number }>();
  for (const row of usage) {
    if (!row.matchedUserId) continue;
    const u = userById.get(row.matchedUserId);
    const prev = byUserMap.get(row.matchedUserId);
    if (!prev) {
      byUserMap.set(row.matchedUserId, {
        userId: row.matchedUserId,
        userKey: u?.userKey ?? row.matchedUserId,
        name: u?.name ?? row.matchedUser?.name ?? 'Unknown',
        totalTokens: row.totalTokens,
      });
    } else {
      prev.totalTokens += row.totalTokens;
    }
  }

  const accounts = await prisma.cursorAccount.findMany({
    select: { owningUser: true, name: true },
  });
  const accountNameByOwning = new Map(accounts.map((a) => [a.owningUser, a.name]));

  const byOwningMap = new Map<string, number>();
  for (const row of usage) {
    byOwningMap.set(row.owningUser, (byOwningMap.get(row.owningUser) ?? 0) + row.totalTokens);
  }

  const byDayMap = new Map<string, number>();
  for (const row of usage) {
    const day = row.timestampUtc.toISOString().slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + row.totalTokens);
  }

  const largestEvents = [...usage]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      timestampMs: String(r.timestampUtc.getTime()),
      owningUser: r.owningUser,
      model: r.model,
      totalTokens: r.totalTokens,
      chargedCents: r.chargedCents,
      matchStatus: r.matchStatus,
      matchedUserName: r.matchedUser?.name ?? null,
    }));

  return {
    totals: {
      todayTokens: sumTokens(todayRows),
      weekTokens: sumTokens(weekRows),
      monthTokens: sumTokens(monthRows),
      chargedCents,
    },
    byUser: [...byUserMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    byOwningUser: [...byOwningMap.entries()]
      .map(([owningUser, totalTokens]) => ({
        owningUser,
        accountName: accountNameByOwning.get(owningUser) ?? null,
        totalTokens,
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens),
    byDay: [...byDayMap.entries()]
      .map(([day, totalTokens]) => ({ day, totalTokens }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    largestEvents,
    matchHealth: { unknownCount, lowConfidenceCount, unmatchedCount },
  };
}
