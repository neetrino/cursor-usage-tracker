import { describe, expect, it } from 'vitest';
import { createCursorUsageRawHash, createLocalEventRawHash, normalizeRawLine } from './hash';

describe('hash', () => {
  it('createCursorUsageRawHash matches spec example shape', () => {
    const h = createCursorUsageRawHash({
      owningUser: '289049274',
      timestampMs: 1778774357470n,
      model: 'default',
      inputTokens: 4997,
      outputTokens: 175,
      cacheReadTokens: 8448,
    });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('createLocalEventRawHash is stable for same inputs', () => {
    const a = createLocalEventRawHash({
      userKey: 'edgar',
      computerId: 'pc-edgar',
      owningUser: '289049274',
      timestampMs: 1778774358082n,
      marker: 'buildRequestedModel',
      normalizedRawLine: normalizeRawLine('  hello   world  '),
    });
    const b = createLocalEventRawHash({
      userKey: 'edgar',
      computerId: 'pc-edgar',
      owningUser: '289049274',
      timestampMs: 1778774358082n,
      marker: 'buildRequestedModel',
      normalizedRawLine: normalizeRawLine('hello world'),
    });
    expect(a).toBe(b);
  });
});
