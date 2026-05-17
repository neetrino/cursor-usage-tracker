import type { ReactNode } from 'react';
import { buildDashboardSummary } from '@/server/dashboard-summary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] px-5 py-4">
      <p className="text-3xl font-semibold tracking-tight text-[#e5e5e5]">{value}</p>
      <p className="mt-3 text-xs text-[#666]">{label}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="mb-4 h-10 w-10 text-[#333]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          d="M3 13h2l2-7h10l2 7h2M5 13v5a1 1 0 001 1h12a1 1 0 001-1v-5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-sm text-[#666]">{message}</p>
    </div>
  );
}

function TokenChart({ points }: { points: Array<{ day: string; totalTokens: number }> }) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-6">
        <h2 className="text-sm font-medium text-[#e5e5e5]">Token usage</h2>
        <EmptyState message="No usage data yet." />
      </div>
    );
  }

  const width = 640;
  const height = 200;
  const padX = 8;
  const padY = 24;
  const maxY = Math.max(...points.map((p) => p.totalTokens), 1);
  const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;

  const linePoints = points
    .map((p, i) => {
      const x = padX + i * stepX;
      const y = height - padY - ((height - padY * 2) * p.totalTokens) / maxY;
      return `${x},${y}`;
    })
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-6">
      <h2 className="mb-6 text-sm font-medium text-[#e5e5e5]">Token usage</h2>
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Token usage chart">
        <line
          x1={padX}
          x2={width - padX}
          y1={height - padY}
          y2={height - padY}
          stroke="#1f1f1f"
          strokeWidth={1}
        />
        <polyline
          fill="none"
          points={linePoints}
          stroke="#6366f1"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
        {points.map((p, i) => {
          const x = padX + i * stepX;
          const y = height - padY - ((height - padY * 2) * p.totalTokens) / maxY;
          return <circle cx={x} cy={y} fill="#6366f1" key={p.day} r={3} />;
        })}
      </svg>
      <div className="mt-4 flex justify-between text-xs text-[#666]">
        <span>{first.day}</span>
        <span>{last.day}</span>
      </div>
    </div>
  );
}

function SectionTable({
  title,
  headers,
  rows,
  emptyMessage,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<ReactNode>>;
  emptyMessage: string;
}) {
  return (
    <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
      <h2 className="mb-4 text-sm font-medium text-[#e5e5e5]">{title}</h2>
      {rows.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#666]">
                {headers.map((h) => (
                  <th className="pb-3 pr-4 font-medium" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  className="border-t border-[#1f1f1f] transition-colors hover:bg-[#1a1a1a]"
                  key={idx}
                >
                  {row.map((cell, ci) => (
                    <td className="py-3 pr-4 text-[#e5e5e5]" key={ci}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function DashboardSummaryPage() {
  const s = await buildDashboardSummary();
  const costUsd = (s.totals.chargedCents / 100).toFixed(2);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[#e5e5e5]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#666]">Matched Cursor usage · UTC windows</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Today" value={s.totals.todayTokens.toLocaleString()} />
        <MetricCard label="Week" value={s.totals.weekTokens.toLocaleString()} />
        <MetricCard label="Month" value={s.totals.monthTokens.toLocaleString()} />
        <MetricCard label="Total cost" value={`$${costUsd}`} />
      </div>

      <TokenChart points={s.byDay} />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionTable
          title="By user"
          headers={['User', 'Tokens']}
          emptyMessage="No matched usage yet."
          rows={s.byUser.map((u) => [
            <span key={u.userId}>
              <span className="block font-medium">{u.name}</span>
              <span className="text-xs text-[#666]">{u.userKey}</span>
            </span>,
            u.totalTokens.toLocaleString(),
          ])}
        />
        <SectionTable
          title="By account"
          headers={['Account', 'Tokens']}
          emptyMessage="No usage by account."
          rows={s.byOwningUser.map((o) => [
            <span key={o.owningUser}>
              <span className="font-mono text-xs">{o.owningUser}</span>
              {o.accountName ? (
                <span className="mt-0.5 block text-xs text-[#666]">{o.accountName}</span>
              ) : null}
            </span>,
            o.totalTokens.toLocaleString(),
          ])}
        />
      </div>

      <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
        <h2 className="mb-4 text-sm font-medium text-[#e5e5e5]">Match health</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3">
            <p className="text-2xl font-semibold">{s.matchHealth.unknownCount}</p>
            <p className="mt-1 text-xs text-[#666]">Unknown</p>
          </div>
          <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3">
            <p className="text-2xl font-semibold">{s.matchHealth.lowConfidenceCount}</p>
            <p className="mt-1 text-xs text-[#666]">Low confidence</p>
          </div>
          <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3">
            <p className="text-2xl font-semibold">{s.matchHealth.unmatchedCount}</p>
            <p className="mt-1 text-xs text-[#666]">Unmatched</p>
          </div>
        </div>
      </section>
    </div>
  );
}
