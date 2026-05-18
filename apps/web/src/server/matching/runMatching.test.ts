import { describe, expect, it } from 'vitest';
import { decideMatchForUsage } from './runMatching';

describe('decideMatchForUsage', () => {
  const env = { maxDiffMs: 3000, autoConfidentMs: 500 };

  it('matches nearest candidate', () => {
    const usage = { owningUser: '289049274', timestampMs: 1778774357470n, totalTokens: 50 };
    const locals = [
      {
        id: 'l1',
        owningUser: '289049274',
        timestampMs: 1778774358082n,
        userId: 'u1',
        marker: 'buildRequestedModel',
      },
    ];
    const d = decideMatchForUsage({ usage, locals, env });
    expect(d.status).toBe('matched');
    if (d.status === 'matched') {
      expect(d.matchDiffMs).toBe(612);
    }
  });

  it('returns unknown when no same owningUser candidates', () => {
    const usage = { owningUser: '289049274', timestampMs: 1778774357470n, totalTokens: 50 };
    const locals = [
      { id: 'l1', owningUser: '999', timestampMs: 1778774358082n, userId: 'u1', marker: 'buildRequestedModel' },
    ];
    const d = decideMatchForUsage({ usage, locals, env });
    expect(d.status).toBe('unknown');
  });

  it('ignores zero-token usage rows', () => {
    const usage = { owningUser: '289049274', timestampMs: 1000n, totalTokens: 0 };
    const locals = [
      { id: 'l1', owningUser: '289049274', timestampMs: 1005n, userId: 'u1', marker: 'buildRequestedModel' },
    ];
    const d = decideMatchForUsage({ usage, locals, env });
    expect(d.status).toBe('ignored_zero_tokens');
  });

  it('marks low_confidence when top two diffs are too close', () => {
    const usage = { owningUser: '289049274', timestampMs: 1000n, totalTokens: 100 };
    const locals = [
      { id: 'l1', owningUser: '289049274', timestampMs: 1005n, userId: 'u1', marker: 'buildRequestedModel' },
      { id: 'l2', owningUser: '289049274', timestampMs: 1007n, userId: 'u2', marker: 'buildRequestedModel' },
    ];
    const d = decideMatchForUsage({ usage, locals, env });
    expect(d.status).toBe('low_confidence');
  });
});
