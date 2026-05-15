import { getPrisma } from '@/server/db';
import {
  importCursorUsageJsonAction,
  runMatchingNowAction,
  syncCursorUsageNowAction,
} from '@/server/dashboard-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  const syncEnabled = (process.env.CURSOR_USAGE_SYNC_ENABLED ?? 'false').toLowerCase() === 'true';
  const hasApiUrl = Boolean(process.env.CURSOR_USAGE_API_URL);
  const hasHeaders = Boolean(process.env.CURSOR_USAGE_HEADERS_JSON);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-slate-400">
          Server-side sync uses <code className="text-slate-200">CURSOR_USAGE_*</code> env vars and
          never exposes secrets to the browser.
        </p>
      </div>

      {sp.imported === '1' ? (
        <p className="rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Import completed.
        </p>
      ) : null}
      {typeof sp.importError === 'string' ? (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          Import error: {sp.importError}
        </p>
      ) : null}
      {sp.synced === '1' ? (
        <p className="rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Sync completed.
        </p>
      ) : null}
      {typeof sp.syncError === 'string' ? (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          Sync error: {sp.syncError}
        </p>
      ) : null}
      {sp.matched === '1' ? (
        <p className="rounded-md border border-emerald-900 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Matching completed.
        </p>
      ) : null}
      {typeof sp.matchError === 'string' ? (
        <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          Matching error: {sp.matchError}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">API status</h2>
        <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
          <div>
            CURSOR_USAGE_SYNC_ENABLED: <span className="font-mono">{String(syncEnabled)}</span>
          </div>
          <div>
            CURSOR_USAGE_API_URL set: <span className="font-mono">{String(hasApiUrl)}</span>
          </div>
          <div>
            CURSOR_USAGE_HEADERS_JSON set: <span className="font-mono">{String(hasHeaders)}</span>
          </div>
        </div>
        <form action={syncCursorUsageNowAction}>
          <button
            className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-40"
            disabled={!syncEnabled || !hasApiUrl}
            type="submit"
          >
            Sync Cursor usage now
          </button>
        </form>
        <form action={runMatchingNowAction}>
          <button className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900" type="submit">
            Run matching now
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Manual JSON import</h2>
        <form action={importCursorUsageJsonAction} className="space-y-3">
          <textarea
            className="min-h-[220px] w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
            name="json"
            placeholder='Paste Cursor dashboard JSON: { "totalUsageEventsCount": ..., "usageEventsDisplay": [...] }'
            required
          />
          <button className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white" type="submit">
            Import usage JSON
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Cursor accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">owningUser</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr className="border-t border-slate-800" key={a.id}>
                  <td className="py-2">{a.name}</td>
                  <td className="py-2 font-mono text-xs">{a.owningUser}</td>
                  <td className="py-2 text-slate-400">{a.description ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Internal users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">userKey</th>
                <th className="py-2">Name</th>
                <th className="py-2">computerId</th>
                <th className="py-2">Account</th>
                <th className="py-2">owningUser</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr className="border-t border-slate-800" key={u.id}>
                  <td className="py-2">{u.userKey}</td>
                  <td className="py-2">{u.name}</td>
                  <td className="py-2 font-mono text-xs">{u.computerId}</td>
                  <td className="py-2">{u.cursorAccount.name}</td>
                  <td className="py-2 font-mono text-xs">{u.cursorAccount.owningUser}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recent sync runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2">Started</th>
                <th className="py-2">Source</th>
                <th className="py-2">Status</th>
                <th className="py-2">Imported</th>
                <th className="py-2">Skipped dupes</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr className="border-t border-slate-800" key={r.id}>
                  <td className="py-2 font-mono text-xs">{r.startedAt.toISOString()}</td>
                  <td className="py-2">{r.source}</td>
                  <td className="py-2">{r.status}</td>
                  <td className="py-2">{r.importedCount}</td>
                  <td className="py-2">{r.skippedDuplicateCount}</td>
                  <td className="py-2 text-slate-400">{r.errorMessage ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
