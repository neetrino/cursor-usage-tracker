import { getPrisma } from '@/server/db';
import type { Prisma } from '@prisma/client';

export default async function UsageEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const owningUser = typeof sp.owningUser === 'string' ? sp.owningUser : undefined;
  const matchStatus = typeof sp.matchStatus === 'string' ? sp.matchStatus : undefined;
  const userId = typeof sp.userId === 'string' ? sp.userId : undefined;
  const from = typeof sp.from === 'string' ? sp.from : undefined;
  const to = typeof sp.to === 'string' ? sp.to : undefined;

  const prisma = getPrisma();
  const where: Prisma.CursorUsageEventWhereInput = {};
  if (owningUser) where.owningUser = owningUser;
  if (matchStatus) where.matchStatus = matchStatus;
  if (userId) where.matchedUserId = userId;
  if (from || to) {
    where.timestampUtc = {};
    if (from) where.timestampUtc.gte = new Date(from);
    if (to) where.timestampUtc.lte = new Date(to);
  }

  const users = await prisma.internalUser.findMany({
    orderBy: { userKey: 'asc' },
    select: { id: true, userKey: true, name: true },
  });

  const rows = await prisma.cursorUsageEvent.findMany({
    where,
    orderBy: { timestampUtc: 'desc' },
    take: 200,
    include: { matchedUser: { select: { userKey: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cursor usage events</h1>
        <p className="mt-2 text-sm text-slate-400">Showing up to 200 rows.</p>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/30 p-4 md:grid-cols-3"
      >
        <label className="text-sm text-slate-300">
          From (ISO)
          <input className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-sm" name="from" defaultValue={from ?? ''} />
        </label>
        <label className="text-sm text-slate-300">
          To (ISO)
          <input className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-sm" name="to" defaultValue={to ?? ''} />
        </label>
        <label className="text-sm text-slate-300">
          owningUser
          <input
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-sm"
            name="owningUser"
            defaultValue={owningUser ?? ''}
          />
        </label>
        <label className="text-sm text-slate-300">
          Status
          <select
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-sm"
            name="matchStatus"
            defaultValue={matchStatus ?? ''}
          >
            <option value="">Any</option>
            <option value="matched">matched</option>
            <option value="unmatched">unmatched</option>
            <option value="unknown">unknown</option>
            <option value="low_confidence">low_confidence</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">
          Matched user
          <select className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-sm" name="userId" defaultValue={userId ?? ''}>
            <option value="">Any</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.userKey} — {u.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2">Time (UTC)</th>
              <th className="py-2">owningUser</th>
              <th className="py-2">Model</th>
              <th className="py-2">In</th>
              <th className="py-2">Out</th>
              <th className="py-2">Cache</th>
              <th className="py-2">Total</th>
              <th className="py-2">Charged</th>
              <th className="py-2">Matched</th>
              <th className="py-2">Diff ms</th>
              <th className="py-2">Conf</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-t border-slate-800" key={r.id}>
                <td className="py-2 font-mono text-xs">{r.timestampUtc.toISOString()}</td>
                <td className="py-2 font-mono text-xs">{r.owningUser}</td>
                <td className="py-2">{r.model}</td>
                <td className="py-2">{r.inputTokens}</td>
                <td className="py-2">{r.outputTokens}</td>
                <td className="py-2">{r.cacheReadTokens}</td>
                <td className="py-2">{r.totalTokens}</td>
                <td className="py-2">{r.chargedCents == null ? '-' : r.chargedCents.toFixed(4)}</td>
                <td className="py-2">{r.matchedUser ? `${r.matchedUser.name} (${r.matchedUser.userKey})` : '-'}</td>
                <td className="py-2">{r.matchDiffMs ?? '-'}</td>
                <td className="py-2">{r.matchConfidence == null ? '-' : r.matchConfidence.toFixed(2)}</td>
                <td className="py-2">{r.matchStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
