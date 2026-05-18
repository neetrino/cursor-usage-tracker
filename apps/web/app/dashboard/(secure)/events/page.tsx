import { getPrisma } from '@/server/db';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="mb-4 h-10 w-10 text-[#333]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="text-sm text-[#666]">No events match your filters.</p>
    </div>
  );
}

function FilterInput({
  label,
  name,
  defaultValue,
  type = 'text',
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="block text-xs text-[#666]">
      {label}
      <input
        className="mt-1.5 w-full rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#6366f1]"
        defaultValue={defaultValue}
        name={name}
        type={type}
      />
    </label>
  );
}

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
  if (matchStatus) {
    where.matchStatus = matchStatus;
  } else {
    where.matchStatus = { not: 'ignored_zero_tokens' };
  }
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
        <h1 className="text-xl font-semibold text-[#e5e5e5]">Events</h1>
        <p className="mt-1 text-sm text-[#666]">Cursor usage events · up to 200 rows</p>
      </div>

      <form
        className="grid gap-4 rounded-xl border border-[#1f1f1f] bg-[#111111] p-5 md:grid-cols-3"
        method="get"
      >
        <FilterInput defaultValue={from ?? ''} label="From (ISO)" name="from" />
        <FilterInput defaultValue={to ?? ''} label="To (ISO)" name="to" />
        <FilterInput defaultValue={owningUser ?? ''} label="owningUser" name="owningUser" />
        <label className="block text-xs text-[#666]">
          Status
          <select
            className="mt-1.5 w-full rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#6366f1]"
            defaultValue={matchStatus ?? ''}
            name="matchStatus"
          >
            <option value="">Any</option>
            <option value="matched">matched</option>
            <option value="unmatched">unmatched</option>
            <option value="unknown">unknown</option>
            <option value="low_confidence">low_confidence</option>
            <option value="ignored_zero_tokens">ignored_zero_tokens</option>
          </select>
        </label>
        <label className="block text-xs text-[#666]">
          Matched user
          <select
            className="mt-1.5 w-full rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#6366f1]"
            defaultValue={userId ?? ''}
            name="userId"
          >
            <option value="">Any</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.userKey} — {u.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            className="w-full rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            type="submit"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#111111]">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f] text-left text-xs text-[#666]">
                  <th className="px-4 py-3 font-medium">Time (UTC)</th>
                  <th className="px-4 py-3 font-medium">owningUser</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Charged</th>
                  <th className="px-4 py-3 font-medium">Matched</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    className="border-t border-[#1f1f1f] transition-colors hover:bg-[#1a1a1a]"
                    key={r.id}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[#e5e5e5]">
                      {r.timestampUtc.toISOString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#666]">{r.owningUser}</td>
                    <td className="px-4 py-3 text-[#e5e5e5]">{r.model}</td>
                    <td className="px-4 py-3 text-[#e5e5e5]">{r.totalTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-[#e5e5e5]">
                      {r.chargedCents == null ? '—' : r.chargedCents.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-[#e5e5e5]">
                      {r.matchedUser ? `${r.matchedUser.name}` : '—'}
                    </td>
                    <td
                      className={`px-4 py-3 ${r.matchStatus === 'ignored_zero_tokens' ? 'text-[#444]' : 'text-[#666]'}`}
                    >
                      {r.matchStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
