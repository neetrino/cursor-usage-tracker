'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { HistoryCounts } from '@/server/clear-history';

const CONFIRM_PHRASE = 'CLEAR HISTORY';

export function ClearHistoryDangerZone({ initialCounts }: { initialCounts: HistoryCounts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<HistoryCounts>(initialCounts);
  const [countsLoading, setCountsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    setCountsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/history-counts', { credentials: 'include' });
      const data = (await res.json()) as {
        ok?: boolean;
        counts?: HistoryCounts;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.counts) {
        setFetchError(data.error ?? 'Failed to load counts');
        return;
      }
      setCounts(data.counts);
    } catch {
      setFetchError('Failed to load counts');
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setTyped('');
    setSubmitError(null);
    void loadCounts();
  }, [open, loadCounts]);

  function closeModal() {
    if (submitting) return;
    setOpen(false);
    setTyped('');
    setSubmitError(null);
  }

  async function handleDelete() {
    if (typed !== CONFIRM_PHRASE) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/admin/clear-history', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmation: CONFIRM_PHRASE }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setSubmitError(data.error ?? 'Failed to clear history');
        return;
      }
      setCounts({ localEvents: 0, cursorUsageEvents: 0, syncRuns: 0 });
      setSuccessMessage('History cleared successfully.');
      setOpen(false);
      setTyped('');
      router.refresh();
    } catch {
      setSubmitError('Failed to clear history');
    } finally {
      setSubmitting(false);
    }
  }

  const canDelete = typed === CONFIRM_PHRASE && !countsLoading && !submitting;

  return (
    <>
      <section className="rounded-xl border border-red-900/60 bg-red-950/20 p-5">
        <h2 className="text-sm font-medium text-red-300">Danger Zone</h2>
        <div className="mt-4 border-t border-red-900/40 pt-4">
          <h3 className="text-sm font-medium text-[#e5e5e5]">Clear History</h3>
          <p className="mt-2 max-w-2xl text-sm text-[#999]">
            Deletes all local extension events, all imported Cursor usage events, and sync/import
            history. Users and Cursor account mappings will be kept.
          </p>
          <p className="mt-3 text-xs text-[#666]">
            Current: {counts.localEvents.toLocaleString()} local events,{' '}
            {counts.cursorUsageEvents.toLocaleString()} usage events,{' '}
            {counts.syncRuns.toLocaleString()} sync runs.
          </p>
          {successMessage ? (
            <p className="mt-3 text-sm text-emerald-400" role="status">
              {successMessage}
            </p>
          ) : null}
          <button
            className="mt-4 rounded-xl border border-red-800 bg-red-900/40 px-4 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-900/70"
            onClick={() => setOpen(true)}
            type="button"
          >
            Clear History
          </button>
        </div>
      </section>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              onClick={closeModal}
              role="presentation"
            >
              <div
                aria-labelledby="clear-history-title"
                aria-modal="true"
                className="w-full max-w-md rounded-xl border border-red-900/60 bg-[#111111] p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
              >
                <h3 className="text-base font-semibold text-red-300" id="clear-history-title">
                  Clear all history?
                </h3>
                <p className="mt-2 text-sm text-[#999]">
                  This permanently removes tracking data from the database. Configuration (users,
                  accounts, admin session) is not affected.
                </p>

                <div className="mt-4 rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4 text-sm">
                  {countsLoading ? (
                    <p className="text-[#666]">Loading counts…</p>
                  ) : fetchError ? (
                    <p className="text-red-400">{fetchError}</p>
                  ) : (
                    <ul className="space-y-2 text-[#e5e5e5]">
                      <li>Local events: {counts.localEvents.toLocaleString()}</li>
                      <li>Cursor usage events: {counts.cursorUsageEvents.toLocaleString()}</li>
                      <li>Sync runs: {counts.syncRuns.toLocaleString()}</li>
                    </ul>
                  )}
                </div>

                <label className="mt-4 block text-sm text-[#999]" htmlFor="clear-history-confirm">
                  Type <span className="font-mono text-red-300">{CONFIRM_PHRASE}</span> to confirm
                </label>
                <input
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-[#e5e5e5] outline-none focus:border-red-800"
                  id="clear-history-confirm"
                  onChange={(e) => setTyped(e.target.value)}
                  spellCheck={false}
                  type="text"
                  value={typed}
                />

                {submitError ? (
                  <p className="mt-3 text-sm text-red-400" role="alert">
                    {submitError}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <button
                    className="rounded-xl border border-[#1f1f1f] px-4 py-2 text-sm text-[#e5e5e5] transition-colors hover:bg-[#1a1a1a] disabled:opacity-50"
                    disabled={submitting}
                    onClick={closeModal}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-xl border border-red-800 bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canDelete}
                    onClick={() => void handleDelete()}
                    type="button"
                  >
                    {submitting ? 'Deleting…' : 'Delete all history'}
                  </button>
                </div>
              </div>
        </div>
      ) : null}
    </>
  );
}
