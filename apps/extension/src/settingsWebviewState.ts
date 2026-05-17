import { existsSync, statSync } from 'node:fs';
import type { ExtensionContext } from 'vscode';
import {
  getLastBackendCheck,
  getLastCursorUsageSync,
  getLastMarker,
  getLastSync,
  hasAdminApiKey,
  hasTrackerApiKey,
  loadPublicSettings,
  type ExtensionPublicSettings,
} from './config';
import { getPendingCount } from './queue';
import { asString, isNonEmptyString } from './stringUtil';

function isValidBackendUrl(url: string): boolean {
  const t = asString(url).trim();
  if (!isNonEmptyString(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export type WebviewStatePayload = {
  settings: ExtensionPublicSettings;
  hasApiKey: boolean;
  hasAdminKey: boolean;
  pendingCount: number;
  extensionVersion: string;
  logPathDisplay: string;
  logFileExists: boolean | null;
  lastBackend: string;
  lastMarker: string;
  lastSync: string;
  lastCursorUsageSync: string;
};

export async function buildWebviewState(context: ExtensionContext): Promise<WebviewStatePayload> {
  const settings = loadPublicSettings(context);
  const pendingCount = await getPendingCount(context);
  const version = asString(context.extension.packageJSON.version);
  const logPath = asString(settings.cursorLogPath).trim();
  let logFileExists: boolean | null = null;
  if (isNonEmptyString(logPath)) {
    try {
      logFileExists = existsSync(logPath) && statSync(logPath).isFile();
    } catch {
      logFileExists = false;
    }
  }

  const lb = await getLastBackendCheck(context);
  const lastBackend = lb
    ? `${lb.ok ? 'OK' : 'FAIL'} — ${asString(lb.message)} (${asString(lb.atIso)})`
    : '';

  const lm = await getLastMarker(context);
  const lastMarker = lm
    ? `${asString(lm.markerType)} @ ${asString(lm.timestampUtc)} (ms=${Number.isFinite(lm.timestampMs) ? lm.timestampMs : '?'})`
    : '';

  const ls = await getLastSync(context);
  const lastSync = ls
    ? `sent=${ls.sent} failed=${ls.failed} remaining=${ls.remaining} @ ${asString(ls.atIso)}`
    : '';

  const lcu = await getLastCursorUsageSync(context);
  const lastCursorUsageSync = lcu
    ? `${lcu.ok ? 'OK' : 'FAIL'} — ${asString(lcu.message)} (events=${lcu.eventCount} imported=${lcu.importedCount} skipped=${lcu.skippedDuplicateCount}) @ ${asString(lcu.atIso)}`
    : '';

  return {
    settings,
    hasApiKey: await hasTrackerApiKey(context),
    hasAdminKey: await hasAdminApiKey(context),
    pendingCount,
    extensionVersion: version,
    logPathDisplay: logPath || '(not set)',
    logFileExists,
    lastBackend,
    lastMarker,
    lastSync,
    lastCursorUsageSync,
  };
}

export type NormalizedSaveFormInput = {
  backendUrl: string;
  trackerApiKey: string;
  adminApiKey: string;
  userKey: string;
  userName: string;
  computerId: string;
  owningUser: string;
  cursorAccountGroup: string;
  cursorLogPath: string;
};

type FieldErr = { field: string; message: string };

export function validateSaveForm(form: NormalizedSaveFormInput, hasExistingKey: boolean): FieldErr[] {
  const errors: FieldErr[] = [];
  if (!isNonEmptyString(form.backendUrl) || !isValidBackendUrl(form.backendUrl)) {
    errors.push({ field: 'backendUrl', message: 'Enter a valid http(s) URL.' });
  }
  const keyTrim = asString(form.trackerApiKey).trim();
  if (!hasExistingKey && !isNonEmptyString(keyTrim)) {
    errors.push({ field: 'trackerApiKey', message: 'Tracker API key is required.' });
  }
  if (!isNonEmptyString(form.userKey)) errors.push({ field: 'userKey', message: 'Required.' });
  if (!isNonEmptyString(form.userName)) errors.push({ field: 'userName', message: 'Required.' });
  if (!isNonEmptyString(form.computerId)) errors.push({ field: 'computerId', message: 'Required.' });
  if (!isNonEmptyString(form.owningUser)) errors.push({ field: 'owningUser', message: 'Required.' });
  return errors;
}
