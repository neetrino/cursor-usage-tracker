'use client';

import { useState } from 'react';

const TAMPERMONKEY_HINT =
  'Open cursor.com — Tampermonkey will sync automatically.';

export function SyncFromCursorButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'hint'>('idle');
  const [detail, setDetail] = useState<string | null>(null);

  async function handleSync() {
    setStatus('loading');
    setDetail(null);

    try {
      const res = await fetch('/api/cursor-usage/sync-manual', {
        method: 'POST',
        credentials: 'include',
      });
      const body: unknown = await res.json();
      const data = body as {
        importedCount?: number;
        skippedDuplicateCount?: number;
        clientSyncRequired?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setStatus('hint');
        setDetail(data.error ?? TAMPERMONKEY_HINT);
        return;
      }

      if (data.clientSyncRequired) {
        setStatus('hint');
        setDetail(data.message ?? TAMPERMONKEY_HINT);
        return;
      }

      setStatus('done');
      setDetail(
        `Imported ${data.importedCount ?? 0}, skipped ${data.skippedDuplicateCount ?? 0} duplicates.`,
      );
    } catch {
      setStatus('hint');
      setDetail(TAMPERMONKEY_HINT);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={status === 'loading'}
          onClick={() => void handleSync()}
          type="button"
        >
          {status === 'loading' ? 'Syncing…' : 'Sync from Cursor now'}
        </button>
        <a
          className="rounded-xl border border-[#1f1f1f] px-4 py-2 text-sm text-[#e5e5e5] transition-colors hover:bg-[#1a1a1a]"
          href="https://cursor.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Open cursor.com
        </a>
      </div>
      {detail ? (
        <p
          className={`text-sm ${status === 'done' ? 'text-emerald-400' : 'text-[#666]'}`}
          role="status"
        >
          {detail}
        </p>
      ) : (
        <p className="text-sm text-[#666]">
          Server-side Cursor API calls usually fail without browser cookies. Use Tampermonkey on
          cursor.com or paste JSON below.
        </p>
      )}
    </div>
  );
}
