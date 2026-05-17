import type { PrismaClient } from '@prisma/client';

export const CLEAR_HISTORY_CONFIRMATION = 'CLEAR HISTORY';

export type HistoryCounts = {
  localEvents: number;
  cursorUsageEvents: number;
  syncRuns: number;
};

export async function getHistoryCounts(prisma: PrismaClient): Promise<HistoryCounts> {
  const [localEvents, cursorUsageEvents, syncRuns] = await Promise.all([
    prisma.localAiEvent.count(),
    prisma.cursorUsageEvent.count(),
    prisma.syncRun.count(),
  ]);
  return { localEvents, cursorUsageEvents, syncRuns };
}

export async function clearAllHistory(prisma: PrismaClient): Promise<HistoryCounts> {
  const [cursorUsageResult, localEventsResult, syncRunsResult] = await prisma.$transaction([
    prisma.cursorUsageEvent.deleteMany({}),
    prisma.localAiEvent.deleteMany({}),
    prisma.syncRun.deleteMany({}),
  ]);

  const deleted: HistoryCounts = {
    localEvents: localEventsResult.count,
    cursorUsageEvents: cursorUsageResult.count,
    syncRuns: syncRunsResult.count,
  };

  console.info('[admin] clear-history', {
    at: new Date().toISOString(),
    deleted,
  });

  return deleted;
}
