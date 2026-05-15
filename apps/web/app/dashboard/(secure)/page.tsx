import { buildDashboardSummary } from '@/server/dashboard-summary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function DashboardSummaryPage() {
  const s = await buildDashboardSummary();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Summary</h1>
        <p className="mt-2 text-sm text-slate-400">
          Token totals are based on matched Cursor usage events. Unknown and low-confidence matches
          are expected during MVP tuning.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Tokens today (UTC day)" value={s.totals.todayTokens.toLocaleString()} />
        <Card title="Tokens this week (UTC)" value={s.totals.weekTokens.toLocaleString()} />
        <Card title="Tokens this month (UTC)" value={s.totals.monthTokens.toLocaleString()} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Charged cents (sum)" value={s.totals.chargedCents.toFixed(4)} />
        <Card title="Unknown matches" value={s.matchHealth.unknownCount} />
        <Card title="Low confidence" value={s.matchHealth.lowConfidenceCount} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-medium">By user</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">User</th>
                <th className="py-2">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {s.byUser.length === 0 ? (
                <tr>
                  <td className="py-2 text-slate-400" colSpan={2}>
                    No matched usage yet.
                  </td>
                </tr>
              ) : (
                s.byUser.map((u) => (
                  <tr className="border-t border-slate-800" key={u.userId}>
                    <td className="py-2">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.userKey}</div>
                    </td>
                    <td className="py-2">{u.totalTokens.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-lg font-medium">By owning user</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">Account</th>
                <th className="py-2">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {s.byOwningUser.map((o) => (
                <tr className="border-t border-slate-800" key={o.owningUser}>
                  <td className="py-2">
                    <div className="font-mono text-xs">{o.owningUser}</div>
                    {o.accountName ? <div className="text-xs text-slate-500">{o.accountName}</div> : null}
                  </td>
                  <td className="py-2">{o.totalTokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium">Largest usage events</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">owningUser</th>
                <th className="py-2">Model</th>
                <th className="py-2">Tokens</th>
                <th className="py-2">Charged</th>
                <th className="py-2">Matched</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {s.largestEvents.map((e) => (
                <tr className="border-t border-slate-800" key={e.id}>
                  <td className="py-2 font-mono text-xs">{e.timestampMs}</td>
                  <td className="py-2 font-mono text-xs">{e.owningUser}</td>
                  <td className="py-2">{e.model}</td>
                  <td className="py-2">{e.totalTokens.toLocaleString()}</td>
                  <td className="py-2">{e.chargedCents == null ? '-' : e.chargedCents.toFixed(4)}</td>
                  <td className="py-2">{e.matchedUserName ?? '-'}</td>
                  <td className="py-2">{e.matchStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
