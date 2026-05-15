import { getPrisma } from '@/server/db';
import type { Prisma } from '@prisma/client';

export default async function LocalEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const owningUser = typeof sp.owningUser === 'string' ? sp.owningUser : undefined;
  const userKey = typeof sp.userKey === 'string' ? sp.userKey : undefined;
  const from = typeof sp.from === 'string' ? sp.from : undefined;
  const to = typeof sp.to === 'string' ? sp.to : undefined;

  const prisma = getPrisma();
  const where: Prisma.LocalAiEventWhereInput = {};
  if (owningUser) where.owningUser = owningUser;
  if (userKey) where.userKey = userKey;
  if (from || to) {
    where.timestampUtc = {};
    if (from) where.timestampUtc.gte = new Date(from);
    if (to) where.timestampUtc.lte = new Date(to);
  }

  const rows = await prisma.localAiEvent.findMany({
    where,
    orderBy: { timestampUtc: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Local tracker events</h1>
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
          userKey
          <input className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-2 text-sm" name="userKey" defaultValue={userKey ?? ''} />
        </label>
        <div className="flex items-end">
          <button className="w-full rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white" type="submit">
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-2">Time (UTC)</th>
              <th className="py-2">userKey</th>
              <th className="py-2">userName</th>
              <th className="py-2">computerId</th>
              <th className="py-2">owningUser</th>
              <th className="py-2">marker</th>
              <th className="py-2">rawLineHash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-t border-slate-800" key={r.id}>
                <td className="py-2 font-mono text-xs">{r.timestampUtc.toISOString()}</td>
                <td className="py-2">{r.userKey}</td>
                <td className="py-2">{r.userName}</td>
                <td className="py-2 font-mono text-xs">{r.computerId}</td>
                <td className="py-2 font-mono text-xs">{r.owningUser}</td>
                <td className="py-2">{r.marker}</td>
                <td className="py-2 font-mono text-xs">{r.rawLineHash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
