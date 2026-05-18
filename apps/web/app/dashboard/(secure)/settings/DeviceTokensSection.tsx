'use client';

import { useCallback, useState } from 'react';

type InternalUserRow = {
  id: string;
  userKey: string;
  name: string;
  computerId: string;
  owningUser: string;
};

type DeviceTokenRow = {
  id: string;
  tokenPrefix: string;
  tokenLast4: string;
  computerId: string;
  owningUser: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export function DeviceTokensSection({ users }: { users: InternalUserRow[] }) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? '');
  const [tokens, setTokens] = useState<DeviceTokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);

  const loadTokens = useCallback(async (internalUserId: string) => {
    if (!internalUserId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/device-tokens?internalUserId=${encodeURIComponent(internalUserId)}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const msg =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error: unknown }).error)
            : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const body = (await res.json()) as { tokens: DeviceTokenRow[] };
      setTokens(body.tokens);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const onSelectUser = (id: string) => {
    setSelectedUserId(id);
    setNewToken(null);
    void loadTokens(id);
  };

  const generateToken = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError(null);
    setNewToken(null);
    try {
      const res = await fetch('/api/admin/device-tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ internalUserId: selectedUserId }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error: unknown }).error)
            : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const raw =
        typeof body === 'object' && body !== null && 'rawToken' in body
          ? String((body as { rawToken: unknown }).rawToken)
          : '';
      setNewToken(raw);
      await loadTokens(selectedUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const revokeToken = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/device-tokens/${id}/revoke`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadTokens(selectedUserId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-5">
      <h2 className="mb-2 text-sm font-medium text-[#e5e5e5]">Device tokens</h2>
      <p className="mb-4 text-xs text-[#666]">
        Generate a per-device token for the VS Code extension. Shown once — paste into extension
        settings. Not the admin or global tracker API key.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block text-xs text-[#666]">
          Internal user
          <select
            className="mt-1 block rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5]"
            onChange={(e) => onSelectUser(e.target.value)}
            value={selectedUserId}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.userKey} ({u.computerId})
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-xl bg-[#6366f1] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={loading || !selectedUserId}
          onClick={() => void generateToken()}
          type="button"
        >
          Generate device token
        </button>
        <button
          className="rounded-xl border border-[#1f1f1f] px-4 py-2 text-sm text-[#e5e5e5] hover:bg-[#1a1a1a] disabled:opacity-50"
          disabled={loading || !selectedUserId}
          onClick={() => void loadTokens(selectedUserId)}
          type="button"
        >
          Refresh list
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      {newToken ? (
        <div className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/30 p-4">
          <p className="mb-2 text-xs font-medium text-amber-300">Copy this token now (shown once)</p>
          <code className="block break-all rounded-lg bg-[#0a0a0a] p-3 font-mono text-xs text-[#e5e5e5]">
            {newToken}
          </code>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#666]">
              <th className="pb-3 pr-4 font-medium">Token</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Last used</th>
              <th className="pb-3 pr-4 font-medium">Created</th>
              <th className="pb-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td className="py-3 text-[#666]" colSpan={5}>
                  {loading ? 'Loading…' : 'No tokens — generate one or click Refresh list.'}
                </td>
              </tr>
            ) : (
              tokens.map((t) => (
                <tr className="border-t border-[#1f1f1f]" key={t.id}>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {t.tokenPrefix}…{t.tokenLast4}
                  </td>
                  <td className="py-3 pr-4 text-[#e5e5e5]">
                    {t.isActive && !t.revokedAt ? 'active' : 'revoked'}
                  </td>
                  <td className="py-3 pr-4 text-[#666]">
                    {t.lastUsedAt ? new Date(t.lastUsedAt).toISOString() : '—'}
                  </td>
                  <td className="py-3 pr-4 text-[#666]">
                    {new Date(t.createdAt).toISOString()}
                  </td>
                  <td className="py-3">
                    {t.isActive && !t.revokedAt ? (
                      <button
                        className="text-xs text-red-400 hover:underline"
                        disabled={loading}
                        onClick={() => void revokeToken(t.id)}
                        type="button"
                      >
                        Revoke
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
