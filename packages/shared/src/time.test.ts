import { describe, expect, it } from 'vitest';
import { parseCursorTimestampMs } from './time';

describe('time', () => {
  it('parseCursorTimestampMs parses numeric string', () => {
    expect(parseCursorTimestampMs('1778774357470')).toBe(1778774357470n);
  });
});
