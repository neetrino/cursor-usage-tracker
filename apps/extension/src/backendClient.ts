import { asString } from './stringUtil';

export type TrackerHealthOk = {
  ok: true;
  service: string;
  time: string;
};

export type TrackerAuth =
  | { kind: 'device'; token: string }
  | { kind: 'legacy'; apiKey: string };

function trackerAuthHeaders(auth: TrackerAuth): Record<string, string> {
  if (auth.kind === 'device') {
    return { authorization: `Bearer ${asString(auth.token).trim()}` };
  }
  return { 'x-tracker-api-key': asString(auth.apiKey).trim() };
}

export async function postTrackerEvents(params: {
  baseUrl: string;
  auth: TrackerAuth;
  events: unknown[];
}): Promise<void> {
  const url = new URL('/api/tracker/events', asString(params.baseUrl).trim());
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...trackerAuthHeaders(params.auth),
    },
    body: JSON.stringify({ events: params.events }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tracker POST failed: HTTP ${res.status} ${text}`);
  }
}

export async function testBackendConnection(params: {
  baseUrl: string;
  auth: TrackerAuth;
}): Promise<{ ok: true; body: TrackerHealthOk } | { ok: false; message: string }> {
  const base = asString(params.baseUrl).trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL('/api/tracker/health', base);
  } catch {
    return { ok: false, message: 'Invalid backend URL' };
  }
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: trackerAuthHeaders(params.auth),
    });
    if (res.status === 401) {
      return { ok: false, message: 'Unauthorized (check device token)' };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, message: `HTTP ${res.status} ${text}`.trim() };
    }
    const body: unknown = await res.json().catch(() => null);
    if (
      typeof body === 'object' &&
      body !== null &&
      'ok' in body &&
      (body as { ok?: unknown }).ok === true
    ) {
      return { ok: true, body: body as TrackerHealthOk };
    }
    return { ok: false, message: 'Unexpected health response' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}
