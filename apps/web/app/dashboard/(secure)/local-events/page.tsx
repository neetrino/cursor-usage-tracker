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
        <path d="M4 7h16M4 12h16M4 17h10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm text-[#666]">No local events match your filters.</p>
    </div>
  );
}

function FilterInput({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <label className="block text-xs text-[#666]">
      {label}
      <input
        className="mt-1.5 w-full rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#6366f1]"
        defaultValue={defaultValue}
        name={name}
      />
    </label>
  );
}

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
        <h1 className="text-xl font-semibold text-[#e5e5e5]">Local events</h1>
        <p className="mt-1 text-sm text-[#666]">Extension tracker events · up to 200 rows</p>
      </div>

      <form
        className="grid gap-4 rounded-xl border border-[#1f1f1f] bg-[#111111] p-5 md:grid-cols-3"
        method="get"
      >
        <FilterInput defaultValue={from ?? ''} label="From (ISO)" name="from" />
        <FilterInput defaultValue={to ?? ''} label="To (ISO)" name="to" />
        <FilterInput defaultValue={owningUser ?? ''} label="owningUser" name="owningUser" />
        <FilterInput defaultValue={userKey ?? ''} label="userKey" name="userKey" />
        <div className="flex items-end md:col-span-2">
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
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f] text-left text-xs text-[#666]">
                  <th className="px-4 py-3 font-medium">Time (UTC)</th>
                  <th className="px-4 py-3 font-medium">userKey</th>
                  <th className="px-4 py-3 font-medium">userName</th>
                  <th className="px-4 py-3 font-medium">computerId</th>
                  <th className="px-4 py-3 font-medium">owningUser</th>
                  <th className="px-4 py-3 font-medium">marker</th>
                  <th className="px-4 py-3 font-medium">rawLineHash</th>
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
                    <td className="px-4 py-3 text-[#e5e5e5]">{r.userKey}</td>
                    <td className="px-4 py-3 text-[#e5e5e5]">{r.userName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#666]">{r.computerId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#666]">{r.owningUser}</td>
                    <td className="px-4 py-3 text-[#666]">{r.marker}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#666]">{r.rawLineHash}</td>
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
