export async function postTrackerEvents(params: {
  baseUrl: string;
  apiKey: string;
  events: unknown[];
}): Promise<void> {
  const url = new URL('/api/tracker/events', params.baseUrl);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tracker-api-key': params.apiKey,
    },
    body: JSON.stringify({ events: params.events }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Tracker POST failed: HTTP ${res.status} ${text}`);
  }
}
