import { existsSync, statSync } from 'node:fs';
import type { ExtensionContext } from 'vscode';
import {
  getLastBackendCheck,
  getLastEventSent,
  getLastLogDiscovery,
  getLastMarker,
  getLastSync,
  getLogFileLastWriteTime,
  hasDeviceToken,
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
  hasDeviceToken: boolean;
  pendingCount: number;
  extensionVersion: string;
  logPathDisplay: string;
  logFileExists: boolean | null;
  lastBackend: string;
  lastMarker: string;
  lastSync: string;
  lastEventSent: string;
  lastLogDiscovery: string;
  logFileLastWriteTime: string;
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

  const le = await getLastEventSent(context);
  const lastEventSent = le ? `${asString(le.marker)} @ ${asString(le.atIso)}` : '';

  const ld = await getLastLogDiscovery(context);
  const lastLogDiscovery = ld
    ? `${asString(ld.path)} @ ${asString(ld.atIso)} (mtime=${new Date(ld.mtimeMs).toISOString()})`
    : '';

  const lw = await getLogFileLastWriteTime(context);
  const logFileLastWriteTime =
    typeof lw === 'number' && Number.isFinite(lw) ? new Date(lw).toISOString() : '';

  return {
    settings,
    hasDeviceToken: await hasDeviceToken(context),
    pendingCount,
    extensionVersion: version,
    logPathDisplay: logPath || '(auto-discover)',
    logFileExists,
    lastBackend,
    lastMarker,
    lastSync,
    lastEventSent,
    lastLogDiscovery,
    logFileLastWriteTime,
  };
}

export type NormalizedSaveFormInput = {
  backendUrl: string;
  deviceToken: string;
  userKey: string;
  userName: string;
  computerId: string;
  owningUser: string;
  cursorAccountGroup: string;
  cursorLogPath: string;
};

type FieldErr = { field: string; message: string };

export function validateSaveForm(form: NormalizedSaveFormInput, hasExistingToken: boolean): FieldErr[] {
  const errors: FieldErr[] = [];
  if (!isNonEmptyString(form.backendUrl) || !isValidBackendUrl(form.backendUrl)) {
    errors.push({ field: 'backendUrl', message: 'Enter a valid http(s) URL.' });
  }
  const tokenTrim = asString(form.deviceToken).trim();
  if (!hasExistingToken && !isNonEmptyString(tokenTrim)) {
    errors.push({
      field: 'deviceToken',
      message: 'Device token is required (generate in dashboard Settings).',
    });
  }
  if (!isNonEmptyString(form.userKey)) errors.push({ field: 'userKey', message: 'Required.' });
  if (!isNonEmptyString(form.userName)) errors.push({ field: 'userName', message: 'Required.' });
  if (!isNonEmptyString(form.computerId)) errors.push({ field: 'computerId', message: 'Required.' });
  if (!isNonEmptyString(form.owningUser)) errors.push({ field: 'owningUser', message: 'Required.' });
  return errors;
}
