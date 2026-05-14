import {
  cursorUsageImportSchema,
  normalizeCursorUsageEvent,
  type CursorUsageImportPayload,
} from '@cursor-usage-tracker/shared';
import type { Prisma, PrismaClient } from '@prisma/client';
import { runMatchingPass } from './matching/runMatching';

export type ImportCursorUsageResult = {
  importedCount: number;
  skippedDuplicateCount: number;
  syncRunId: string;
};

export async function importCursorUsageJson(params: {
  prisma: PrismaClient;
  rawBody: unknown;
  source: string;
  runMatch: boolean;
}): Promise<ImportCursorUsageResult> {
  const parsed = cursorUsageImportSchema.parse(params.rawBody);
  return importCursorUsagePayload({
    prisma: params.prisma,
    payload: parsed,
    source: params.source,
    runMatch: params.runMatch,
  });
}

export async function importCursorUsagePayload(params: {
  prisma: PrismaClient;
  payload: CursorUsageImportPayload;
  source: string;
  runMatch: boolean;
}): Promise<ImportCursorUsageResult> {
  const { prisma, payload, source, runMatch } = params;

  const syncRun = await prisma.syncRun.create({
    data: {
      source,
      status: 'running',
      startedAt: new Date(),
    },
  });

  let importedCount = 0;
  let skippedDuplicateCount = 0;

  try {
    for (const row of payload.usageEventsDisplay) {
      const normalized = normalizeCursorUsageEvent(row);
      const rawJson = row as unknown as Prisma.InputJsonValue;
      try {
        await prisma.cursorUsageEvent.create({
          data: {
            owningUser: normalized.owningUser,
            timestampMs: normalized.timestampMs,
            timestampUtc: new Date(normalized.timestampUtc),
            model: normalized.model,
            kind: normalized.kind,
            inputTokens: normalized.inputTokens,
            outputTokens: normalized.outputTokens,
            cacheReadTokens: normalized.cacheReadTokens,
            totalTokens: normalized.totalTokens,
            chargedCents: normalized.chargedCents,
            requestsCosts: normalized.requestsCosts,
            totalCents: normalized.totalCents,
            isChargeable: normalized.isChargeable,
            isTokenBasedCall: normalized.isTokenBasedCall,
            isHeadless: normalized.isHeadless,
            rawHash: normalized.rawHash,
            rawJson,
            matchStatus: 'unmatched',
          },
        });
        importedCount += 1;
      } catch (e: unknown) {
        if (isPrismaUniqueViolation(e)) {
          skippedDuplicateCount += 1;
          continue;
        }
        throw e;
      }
    }

    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        importedCount,
        skippedDuplicateCount,
        metadata: { totalUsageEventsCount: payload.totalUsageEventsCount ?? null },
      },
    });

    if (runMatch) {
      await runMatchingPass(prisma);
    }

    return { importedCount, skippedDuplicateCount, syncRunId: syncRun.id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        importedCount,
        skippedDuplicateCount,
        errorMessage: message,
      },
    });
    throw e;
  }
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002';
}
