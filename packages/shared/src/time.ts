export function parseCursorTimestampMs(timestamp: string): bigint {
  const trimmed = String(timestamp).trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid Cursor timestamp: ${timestamp}`);
  }

  return BigInt(trimmed);
}

/**
 * Parses leading local log timestamp: YYYY-MM-DD HH:mm:ss.SSS
 * Uses native Date (local components) — avoids Luxon in the extension host, where zone/locale code could throw on undefined internals.
 */
export function parseCursorLocalLogTimestampToMs(line: string): bigint {
  if (typeof line !== 'string') {
    throw new Error('Cursor log line must be a string.');
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})/.exec(line);

  if (!m) {
    throw new Error(`Could not parse local log timestamp prefix from line: ${line.slice(0, 80)}`);
  }

  const [, y, mo, d, h, mi, s, ms] = m;

  const date = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
    Number(ms),
  );

  const time = date.getTime();

  if (!Number.isFinite(time)) {
    throw new Error(`Invalid local datetime parsed from line: ${line.slice(0, 80)}`);
  }

  return BigInt(time);
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
