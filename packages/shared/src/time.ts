import { DateTime } from 'luxon';

export function parseCursorTimestampMs(timestamp: string): bigint {
  const trimmed = timestamp.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid Cursor usage timestamp (expected numeric ms string): ${timestamp}`);
  }
  return BigInt(trimmed);
}

/**
 * Parses leading local log timestamp: YYYY-MM-DD HH:mm:ss.SSS
 * Interprets components in the system local timezone (VS Code extension host / Node).
 */
export function parseCursorLocalLogTimestampToMs(line: string): bigint {
  const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})/.exec(line);
  if (!m) {
    throw new Error(`Could not parse local log timestamp prefix from line: ${line.slice(0, 80)}`);
  }
  const local = DateTime.fromFormat(`${m[1]} ${m[2]}`, 'yyyy-MM-dd HH:mm:ss.SSS', {
    zone: 'local',
  });
  if (!local.isValid) {
    throw new Error(`Invalid local datetime: ${local.invalidReason}`);
  }
  return BigInt(local.toMillis());
}

export function toUtcIso(timestampMs: bigint): string {
  return new Date(Number(timestampMs)).toISOString();
}

export function calculateTotalTokens(input: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}): number {
  return input.inputTokens + input.outputTokens + input.cacheReadTokens;
}

export function calculateDiffMs(aMs: bigint, bMs: bigint): number {
  return Math.abs(Number(aMs - bMs));
}
