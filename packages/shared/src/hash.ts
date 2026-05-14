import { createHash } from 'node:crypto';

export function normalizeRawLine(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

export function createCursorUsageRawHash(input: {
  owningUser: string;
  timestampMs: bigint;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}): string {
  const key = [
    input.owningUser,
    input.timestampMs.toString(),
    input.model,
    String(input.inputTokens),
    String(input.outputTokens),
    String(input.cacheReadTokens),
  ].join('|');
  return sha256HexUtf8(key);
}

export function createLocalEventRawHash(input: {
  userKey: string;
  computerId: string;
  owningUser: string;
  timestampMs: bigint;
  marker: string;
  normalizedRawLine: string;
}): string {
  const key = [
    input.userKey,
    input.computerId,
    input.owningUser,
    input.timestampMs.toString(),
    input.marker,
    input.normalizedRawLine,
  ].join('|');
  return sha256HexUtf8(key);
}

function sha256HexUtf8(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
