export const PRIMARY_MARKER = '[buildRequestedModel]';
export const WAKELOCK_ACQUIRED_AGENT_LOOP =
  '[ComposerWakelockManager] Acquired wakelock' as const;

export function detectMarker(line: string | undefined | null): 'buildRequestedModel' | 'wakelock_acquired' | null {
  if (typeof line !== 'string' || line.length === 0) return null;
  if (line.includes(PRIMARY_MARKER)) return 'buildRequestedModel';
  if (line.includes(WAKELOCK_ACQUIRED_AGENT_LOOP) && line.includes('reason="agent-loop"')) {
    return 'wakelock_acquired';
  }
  return null;
}
