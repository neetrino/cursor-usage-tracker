import type * as vscode from 'vscode';
import { readQueue, writeQueue } from './storage';
import { postTrackerEvents } from './backendClient';
import { getTrackerAuthCredential, loadPublicSettings, setLastSync } from './config';
import { asString, isNonEmptyString } from './stringUtil';

export type FlushQueueResult = {
  sent: number;
  failed: number;
  remaining: number;
};

export async function getPendingCount(context: vscode.ExtensionContext): Promise<number> {
  const q = await readQueue(context);
  return q.length;
}

export async function flushPendingQueue(context: vscode.ExtensionContext): Promise<FlushQueueResult> {
  const settings = loadPublicSettings(context);
  const baseUrl = asString(settings.backendUrl).trim().replace(/\/+$/, '');
  const auth = await getTrackerAuthCredential(context);
  const result: FlushQueueResult = { sent: 0, failed: 0, remaining: 0 };

  if (!isNonEmptyString(baseUrl) || !auth) {
    const pending = await readQueue(context);
    result.remaining = pending.length;
    await setLastSync(context, {
      atIso: new Date().toISOString(),
      sent: 0,
      failed: 0,
      remaining: pending.length,
    });
    return result;
  }

  const pending = await readQueue(context);
  if (pending.length === 0) {
    await setLastSync(context, {
      atIso: new Date().toISOString(),
      sent: 0,
      failed: 0,
      remaining: 0,
    });
    return result;
  }

  const remaining: typeof pending = [];
  for (const item of pending) {
    try {
      await postTrackerEvents({ baseUrl, auth, events: [item.payload] });
      result.sent += 1;
    } catch {
      result.failed += 1;
      remaining.push(item);
    }
  }
  result.remaining = remaining.length;
  await writeQueue(context, remaining);
  await setLastSync(context, {
    atIso: new Date().toISOString(),
    sent: result.sent,
    failed: result.failed,
    remaining: result.remaining,
  });
  return result;
}

export async function clearPendingQueue(context: vscode.ExtensionContext): Promise<void> {
  await writeQueue(context, []);
}
