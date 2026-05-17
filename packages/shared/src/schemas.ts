import { z } from 'zod';
import { createCursorUsageRawHash } from './hash.js';
import { calculateTotalTokens, parseCursorTimestampMs, toUtcIso } from './time.js';

export const cursorUsageApiEventSchema = z.object({
  timestamp: z.string(),
  model: z.string(),
  kind: z.string().optional(),
  requestsCosts: z.number().optional(),
  usageBasedCosts: z.union([z.string(), z.number()]).optional(),
  isTokenBasedCall: z.boolean().optional(),
  tokenUsage: z
    .object({
      inputTokens: z.number(),
      outputTokens: z.number(),
      cacheReadTokens: z.number().optional().default(0),
      cacheWriteTokens: z.number().optional(),
      totalCents: z.number().optional(),
    })
    .optional(),
  owningUser: z.string(),
  cursorTokenFee: z.number().optional(),
  isChargeable: z.boolean().optional(),
  serviceAccountId: z.string().optional(),
  isHeadless: z.boolean().optional(),
  chargedCents: z.number().optional(),
});

export const cursorUsageImportSchema = z.object({
  totalUsageEventsCount: z.number().optional(),
  usageEventsDisplay: z.array(cursorUsageApiEventSchema),
});

const bigintFromJson = z.union([
  z.bigint(),
  z.number().transform((n) => BigInt(Math.trunc(n))),
  z.string().transform((s) => BigInt(s.trim())),
]);

export const localAiEventSchema = z.object({
  userKey: z.string().min(1),
  userName: z.string().min(1),
  computerId: z.string().min(1),
  owningUser: z.string().min(1),
  timestampMs: bigintFromJson,
  timestampUtc: z.string().min(1),
  source: z.string().min(1),
  marker: z.string().min(1),
  rawLineHash: z.string().min(1),
});

export const trackerEventsRequestSchema = z.object({
  events: z.array(localAiEventSchema).min(1),
});

export type CursorUsageApiEvent = z.infer<typeof cursorUsageApiEventSchema>;
export type CursorUsageImportPayload = z.infer<typeof cursorUsageImportSchema>;
export type LocalAiEventPayload = z.infer<typeof localAiEventSchema>;
export type TrackerEventsRequest = z.infer<typeof trackerEventsRequestSchema>;

export type CursorUsageApiResponse = CursorUsageImportPayload;

export type CursorUsageEventNormalized = {
  owningUser: string;
  timestampMs: bigint;
  timestampUtc: string;
  model: string;
  kind: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  chargedCents: number | null;
  requestsCosts: number | null;
  totalCents: number | null;
  isChargeable: boolean | null;
  isTokenBasedCall: boolean | null;
  isHeadless: boolean | null;
  rawHash: string;
};

export function normalizeCursorUsageEvent(event: CursorUsageApiEvent): CursorUsageEventNormalized {
  const timestampMs = parseCursorTimestampMs(event.timestamp);
  const inputTokens = event.tokenUsage?.inputTokens ?? 0;
  const outputTokens = event.tokenUsage?.outputTokens ?? 0;
  const cacheReadTokens = event.tokenUsage?.cacheReadTokens ?? 0;
  const totalTokens = calculateTotalTokens({ inputTokens, outputTokens, cacheReadTokens });
  const rawHash = createCursorUsageRawHash({
    owningUser: event.owningUser,
    timestampMs,
    model: event.model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
  });
  return {
    owningUser: event.owningUser,
    timestampMs,
    timestampUtc: toUtcIso(timestampMs),
    model: event.model,
    kind: event.kind ?? null,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    totalTokens,
    chargedCents: event.chargedCents ?? null,
    requestsCosts: event.requestsCosts ?? null,
    totalCents: event.tokenUsage?.totalCents ?? null,
    isChargeable: event.isChargeable ?? null,
    isTokenBasedCall: event.isTokenBasedCall ?? null,
    isHeadless: event.isHeadless ?? null,
    rawHash,
  };
}

export type DashboardSummary = {
  totals: {
    todayTokens: number;
    weekTokens: number;
    monthTokens: number;
    chargedCents: number;
  };
  byUser: Array<{ userId: string; userKey: string; name: string; totalTokens: number }>;
  byOwningUser: Array<{ owningUser: string; accountName: string | null; totalTokens: number }>;
  byDay: Array<{ day: string; totalTokens: number }>;
  largestEvents: Array<{
    id: string;
    timestampMs: string;
    owningUser: string;
    model: string;
    totalTokens: number;
    chargedCents: number | null;
    matchStatus: string;
    matchedUserName: string | null;
  }>;
  matchHealth: {
    unknownCount: number;
    lowConfidenceCount: number;
    unmatchedCount: number;
  };
};
