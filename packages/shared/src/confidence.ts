export function matchConfidenceFromDiffMs(diffMs: number): number {
  if (diffMs <= 100) return 99.9;
  if (diffMs <= 300) return 99;
  if (diffMs <= 700) return 95;
  if (diffMs <= 1500) return 85;
  if (diffMs <= 3000) return 50;
  return 0;
}
