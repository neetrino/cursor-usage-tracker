import { getPrisma } from '@/server/db';
import { getHistoryCounts } from '@/server/clear-history';
import { importCursorUsageJsonAction, runMatchingNowAction } from '@/server/dashboard-actions';
import { ClearHistoryDangerZone } from './ClearHistoryDangerZone';
import { SyncFromCursorButton } from './SyncFromCursorButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function Alert({ tone, children }: { tone: 'ok' | 'err'; children: React.ReactNode }) {
  const styles =
    tone === 'ok'
      ? 'border-emerald-900/50 bg-emerald-950/30 text-emerald-300'
      : 'border-red-900/50 bg-red-950/30 text-red-300';
  return (
    <p className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{children}</p>
  );
}

function DataTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
}) {
  return (
    <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
      <h2 className="mb-4 text-sm font-medium text-[#e5e5e5]">{title}</h2>
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
                  <td
                    className={`py-3 pr-4 ${ci > 0 && headers[ci]?.includes('owning') ? 'font-mono text-xs text-[#666]' : 'text-[#e5e5e5]'}`}
                    key={ci}
                  >
                    {cell ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const prisma = getPrisma();
  const accounts = await prisma.cursorAccount.findMany({ orderBy: { name: 'asc' } });
  const users = await prisma.internalUser.findMany({
    orderBy: { userKey: 'asc' },
    include: { cursorAccount: true },
  });
  const runs = await prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 25 });
  const historyCounts = await getHistoryCounts(prisma);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-[#e5e5e5]">Settings</h1>
        <p className="mt-1 text-sm text-[#666]">
          Sync usage from Cursor, run matching, or import JSON manually.
        </p>
      </div>

      {sp.imported === '1' ? <Alert tone="ok">Import completed.</Alert> : null}
      {typeof sp.importError === 'string' ? (
        <Alert tone="err">Import error: {sp.importError}</Alert>
      ) : null}
      {sp.matched === '1' ? <Alert tone="ok">Matching completed.</Alert> : null}
      {typeof sp.matchError === 'string' ? (
        <Alert tone="err">Matching error: {sp.matchError}</Alert>
      ) : null}
      {sp.synced === '1' ? (
        <Alert tone="ok">
          Sync completed — imported {sp.imported ?? 0}, skipped {sp.skipped ?? 0} duplicates.
        </Alert>
      ) : null}
      {typeof sp.syncError === 'string' ? <Alert tone="err">Sync error: {sp.syncError}</Alert> : null}
      {sp.syncHint === '1' ? (
        <Alert tone="err">
          {typeof sp.message === 'string' && sp.message
            ? decodeURIComponent(sp.message)
            : 'Open cursor.com — Tampermonkey will sync automatically.'}
        </Alert>
      ) : null}

      <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
        <h2 className="mb-4 text-sm font-medium text-[#e5e5e5]">Cursor sync</h2>
        <SyncFromCursorButton />
      </section>

      <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
        <h2 className="mb-4 text-sm font-medium text-[#e5e5e5]">Matching</h2>
        <form action={runMatchingNowAction}>
          <button
            className="rounded-xl border border-[#1f1f1f] px-4 py-2 text-sm text-[#e5e5e5] transition-colors hover:bg-[#1a1a1a]"
            type="submit"
          >
            Run matching now
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
        <h2 className="mb-4 text-sm font-medium text-[#e5e5e5]">Manual JSON import</h2>
        <form action={importCursorUsageJsonAction} className="space-y-3">
          <textarea
            className="min-h-[200px] w-full rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 font-mono text-xs text-[#e5e5e5] outline-none focus:border-[#6366f1]"
            name="json"
            placeholder='{ "totalUsageEventsCount": ..., "usageEventsDisplay": [...] }'
            required
          />
          <button
            className="rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            type="submit"
          >
            Import usage JSON
          </button>
        </form>
      </section>

      <DataTable
        title="Cursor accounts"
        headers={['Name', 'owningUser', 'Description']}
        rows={accounts.map((a) => [a.name, a.owningUser, a.description])}
      />

      <DataTable
        title="Internal users"
        headers={['userKey', 'Name', 'computerId', 'Account', 'owningUser']}
        rows={users.map((u) => [
          u.userKey,
          u.name,
          u.computerId,
          u.cursorAccount.name,
          u.cursorAccount.owningUser,
        ])}
      />

      <DataTable
        title="Recent sync runs"
        headers={['Started', 'Source', 'Status', 'Imported', 'Skipped', 'Error']}
        rows={runs.map((r) => [
          r.startedAt.toISOString(),
          r.source,
          r.status,
          r.importedCount,
          r.skippedDuplicateCount,
          r.errorMessage,
        ])}
      />

      <ClearHistoryDangerZone initialCounts={historyCounts} />
    </div>
  );
}
