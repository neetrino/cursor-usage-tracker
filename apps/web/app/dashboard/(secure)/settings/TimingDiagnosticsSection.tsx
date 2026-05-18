'use client';

import { useCallback, useState } from 'react';
import type { TimingStatsResponse } from '@/server/timing-stats';

export function TimingDiagnosticsSection() {
  const [minutes, setMinutes] = useState(120);
  const [stats, setStats] = useState<TimingStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/timing-stats?minutes=${minutes}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as TimingStatsResponse;
      setStats(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [minutes]);

  return (
    <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
      <h2 className="mb-2 text-sm font-medium text-[#e5e5e5]">Timing diagnostics</h2>
      <p className="mb-4 text-xs text-[#666]">
        Match timing spread for matched usage rows (typical: 20–250ms, max window 3000ms).
      </p>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block text-xs text-[#666]">
          Minutes
          <input
            className="mt-1 block w-24 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5]"
            min={1}
            onChange={(e) => setMinutes(Number(e.target.value) || 120)}
            type="number"
            value={minutes}
          />
        </label>
        <button
          className="rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={loading}
          onClick={() => void refresh()}
          type="button"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {stats ? (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm text-[#e5e5e5] sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Matched count" value={String(stats.count)} />
            <Stat label="Avg abs diff (ms)" value={String(stats.averageAbsDiffMs)} />
            <Stat label="Min / Max (ms)" value={`${stats.minAbsDiffMs} / ${stats.maxAbsDiffMs}`} />
            <Stat
              label="p50 / p90 / p95"
              value={`${stats.p50AbsDiffMs} / ${stats.p90AbsDiffMs} / ${stats.p95AbsDiffMs}`}
            />
            <Stat
              label="Under 100ms"
              value={`${stats.under100ms.count} (${stats.under100ms.percent}%)`}
            />
            <Stat
              label="Under 500ms"
              value={`${stats.under500ms.count} (${stats.under500ms.percent}%)`}
            />
            <Stat
              label="Over 3000ms"
              value={`${stats.over3000ms.count} (${stats.over3000ms.percent}%)`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#666]">
                  <th className="pb-2 pr-3">Cursor UTC</th>
                  <th className="pb-2 pr-3">Local UTC</th>
                  <th className="pb-2 pr-3">Abs diff ms</th>
                  <th className="pb-2 pr-3">Signed ms</th>
                  <th className="pb-2 pr-3">Model</th>
                  <th className="pb-2 pr-3">Tokens</th>
                  <th className="pb-2">User</th>
                </tr>
              </thead>
              <tbody>
                {stats.latest.map((row, i) => (
                  <tr className="border-t border-[#1f1f1f] text-[#e5e5e5]" key={i}>
                    <td className="py-2 pr-3 font-mono">{row.cursorUsageTimestampUtc}</td>
                    <td className="py-2 pr-3 font-mono">{row.localEventTimestampUtc}</td>
                    <td className="py-2 pr-3">{row.absDiffMs}</td>
                    <td className="py-2 pr-3">{row.signedDiffMs}</td>
                    <td className="py-2 pr-3">{row.model}</td>
                    <td className="py-2 pr-3">{row.totalTokens}</td>
                    <td className="py-2">{row.matchedUserName ?? row.matchedUserKey ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2">
      <div className="text-xs text-[#666]">{label}</div>
      <div className="font-mono text-sm text-[#e5e5e5]">{value}</div>
    </div>
  );
}
