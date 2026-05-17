// ==UserScript==
// @name         Cursor Usage → Tracker Import
// @namespace    cursor-usage-tracker
// @version      1.0.0
// @description  Hourly fetch from Cursor dashboard API and POST to usage tracker backend
// @match        https://cursor.com/*
// @match        https://www.cursor.com/*
// @grant        GM_xmlhttpRequest
// @connect      cursor.com
// @connect      cursor.neetrino.com
// ==/UserScript==

(function () {
  'use strict';

  /** Edit before install — do not commit real keys to public repos. */
  const CONFIG = {
    BACKEND_IMPORT_URL: 'https://cursor.neetrino.com/api/cursor-usage/import',
    ADMIN_API_KEY: 'admin123',
    INTERVAL_MS: 60 * 60 * 1000,
    LOOKBACK_MS: 60 * 60 * 1000,
    PAGE_SIZE: 100,
  };

  const CURSOR_USAGE_URL =
    'https://cursor.com/api/dashboard/get-filtered-usage-events';

  function log(...args) {
    console.log('[cursor-usage-sync]', ...args);
  }

  function fetchCursorUsage() {
    const endMs = Date.now();
    const startMs = endMs - CONFIG.LOOKBACK_MS;
    const body = {
      teamId: 0,
      startDate: String(startMs),
      endDate: String(endMs),
      page: 1,
      pageSize: CONFIG.PAGE_SIZE,
    };

    return fetch(CURSOR_USAGE_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://cursor.com',
      },
      body: JSON.stringify(body),
    }).then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`Cursor API HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return JSON.parse(text);
    });
  }

  function postToBackend(payload) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: CONFIG.BACKEND_IMPORT_URL,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': CONFIG.ADMIN_API_KEY,
        },
        data: JSON.stringify(payload),
        onload(response) {
          let parsed;
          try {
            parsed = JSON.parse(response.responseText);
          } catch {
            parsed = response.responseText;
          }
          if (response.status >= 200 && response.status < 300) {
            resolve({ status: response.status, body: parsed });
            return;
          }
          reject(
            new Error(
              `Import HTTP ${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`,
            ),
          );
        },
        onerror() {
          reject(new Error('Import request failed (network)'));
        },
      });
    });
  }

  async function runSync() {
    log('sync start');
    const payload = await fetchCursorUsage();
    const count = payload.usageEventsDisplay?.length ?? 0;
    log('cursor events in page', count, 'total', payload.totalUsageEventsCount);

    const result = await postToBackend(payload);
    log('import ok', result);
  }

  runSync().catch((e) => {
    log('sync error', e instanceof Error ? e.message : e);
  });

  setInterval(() => {
    runSync().catch((e) => {
      log('sync error', e instanceof Error ? e.message : e);
    });
  }, CONFIG.INTERVAL_MS);
})();
