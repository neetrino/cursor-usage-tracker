import * as vscode from 'vscode';
import { asString, isNonEmptyString } from './stringUtil';

const SECRET_DEVICE_TOKEN = 'cursorUsageTracker.deviceToken';
const SECRET_TRACKER_KEY = 'cursorUsageTracker.trackerApiKey';
const SECRET_LEGACY_API_KEY = 'cursorUsageTracker.apiKey';

const GS = {
  backendUrl: 'cut.settings.backendUrl',
  userKey: 'cut.settings.userKey',
  userName: 'cut.settings.userName',
  computerId: 'cut.settings.computerId',
  owningUser: 'cut.settings.owningUser',
  cursorAccountGroup: 'cut.settings.cursorAccountGroup',
  cursorLogPath: 'cut.settings.cursorLogPath',
  lastBackendCheck: 'cut.status.lastBackendCheck',
  lastMarker: 'cut.status.lastMarker',
  lastSync: 'cut.status.lastSync',
  lastEventSent: 'cut.status.lastEventSent',
  lastLogDiscovery: 'cut.status.lastLogDiscovery',
  logFileLastWriteTime: 'cut.status.logFileLastWriteTime',
} as const;

export type ExtensionPublicSettings = {
  backendUrl: string;
  userKey: string;
  userName: string;
  computerId: string;
  owningUser: string;
  cursorAccountGroup: string;
  cursorLogPath: string;
};

export type LastBackendCheck = {
  ok: boolean;
  message: string;
  atIso: string;
};

export type LastMarkerStatus = {
  marker: string;
  markerType: string;
  timestampMs: number;
  timestampUtc: string;
  atIso: string;
};

export type LastSyncStatus = {
  atIso: string;
  sent: number;
  failed: number;
  remaining: number;
};

export type LastEventSentStatus = {
  atIso: string;
  marker: string;
};

export type LastLogDiscoveryStatus = {
  atIso: string;
  path: string;
  mtimeMs: number;
};

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration();
}

function readWorkspace(key: keyof ExtensionPublicSettings): string {
  const map: Record<keyof ExtensionPublicSettings, string> = {
    backendUrl: 'cursorUsageTracker.backendUrl',
    userKey: 'cursorUsageTracker.userKey',
    userName: 'cursorUsageTracker.userName',
    computerId: 'cursorUsageTracker.computerId',
    owningUser: 'cursorUsageTracker.owningUser',
    cursorAccountGroup: 'cursorUsageTracker.cursorAccountGroup',
    cursorLogPath: 'cursorUsageTracker.cursorLogPath',
  };
  const raw = cfg().get<string>(map[key], '');
  return typeof raw === 'string' ? raw.trim() : '';
}

function readString(
  context: vscode.ExtensionContext,
  gsKey: string,
  wsKey: keyof ExtensionPublicSettings,
): string {
  const fromGs = context.globalState.get(gsKey);
  const gsStr = asString(fromGs).trim();
  if (isNonEmptyString(gsStr)) {
    return gsStr;
  }
  return readWorkspace(wsKey);
}

export function loadPublicSettings(context: vscode.ExtensionContext): ExtensionPublicSettings {
  return {
    backendUrl: readString(context, GS.backendUrl, 'backendUrl'),
    userKey: readString(context, GS.userKey, 'userKey'),
    userName: readString(context, GS.userName, 'userName'),
    computerId: readString(context, GS.computerId, 'computerId'),
    owningUser: readString(context, GS.owningUser, 'owningUser'),
    cursorAccountGroup: readString(context, GS.cursorAccountGroup, 'cursorAccountGroup'),
    cursorLogPath: readString(context, GS.cursorLogPath, 'cursorLogPath'),
  };
}

export async function hasDeviceToken(context: vscode.ExtensionContext): Promise<boolean> {
  const key = await getDeviceToken(context);
  return isNonEmptyString(key);
}

export async function getDeviceToken(context: vscode.ExtensionContext): Promise<string | undefined> {
  const raw = await context.secrets.get(SECRET_DEVICE_TOKEN);
  const trimmed = asString(raw).trim();
  return isNonEmptyString(trimmed) ? trimmed : undefined;
}

export async function storeDeviceToken(context: vscode.ExtensionContext, token: string): Promise<void> {
  await context.secrets.store(SECRET_DEVICE_TOKEN, asString(token).trim());
}

export async function clearDeviceToken(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_DEVICE_TOKEN);
}

/** Legacy dev fallback — deprecated */
export async function getTrackerApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const primary = await context.secrets.get(SECRET_TRACKER_KEY);
  const primaryStr = asString(primary).trim();
  if (isNonEmptyString(primaryStr)) return primaryStr;
  const legacy = await context.secrets.get(SECRET_LEGACY_API_KEY);
  const legacyStr = asString(legacy).trim();
  return isNonEmptyString(legacyStr) ? legacyStr : undefined;
}

export async function clearTrackerApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_TRACKER_KEY);
  await context.secrets.delete(SECRET_LEGACY_API_KEY);
}

export async function getTrackerAuthCredential(
  context: vscode.ExtensionContext,
): Promise<{ kind: 'device'; token: string } | { kind: 'legacy'; apiKey: string } | undefined> {
  const device = await getDeviceToken(context);
  if (device) return { kind: 'device', token: device };
  const legacy = await getTrackerApiKey(context);
  if (legacy) return { kind: 'legacy', apiKey: legacy };
  return undefined;
}

export type SavePublicSettingsInput = ExtensionPublicSettings;

export async function saveCursorLogPath(context: vscode.ExtensionContext, cursorLogPath: string): Promise<void> {
  await context.globalState.update(GS.cursorLogPath, asString(cursorLogPath).trim());
}

export async function savePublicSettings(
  context: vscode.ExtensionContext,
  settings: SavePublicSettingsInput,
): Promise<void> {
  await context.globalState.update(GS.backendUrl, asString(settings.backendUrl).trim());
  await context.globalState.update(GS.userKey, asString(settings.userKey).trim());
  await context.globalState.update(GS.userName, asString(settings.userName).trim());
  await context.globalState.update(GS.computerId, asString(settings.computerId).trim());
  await context.globalState.update(GS.owningUser, asString(settings.owningUser).trim());
  await context.globalState.update(GS.cursorAccountGroup, asString(settings.cursorAccountGroup).trim());
  await context.globalState.update(GS.cursorLogPath, asString(settings.cursorLogPath).trim());
}

export async function clearPublicSettings(context: vscode.ExtensionContext): Promise<void> {
  for (const k of Object.values(GS)) {
    if (k.startsWith('cut.settings.')) {
      await context.globalState.update(k, undefined);
    }
  }
}

export async function clearStatusSnapshots(context: vscode.ExtensionContext): Promise<void> {
  const statusKeys = [
    GS.lastBackendCheck,
    GS.lastMarker,
    GS.lastSync,
    GS.lastEventSent,
    GS.lastLogDiscovery,
    GS.logFileLastWriteTime,
  ];
  for (const k of statusKeys) {
    await context.globalState.update(k, undefined);
  }
}

export async function getLastBackendCheck(context: vscode.ExtensionContext): Promise<LastBackendCheck | undefined> {
  return readJsonStatus<LastBackendCheck>(context, GS.lastBackendCheck, (p) => typeof p.ok === 'boolean');
}

export async function setLastBackendCheck(context: vscode.ExtensionContext, value: LastBackendCheck): Promise<void> {
  await context.globalState.update(GS.lastBackendCheck, JSON.stringify(value));
}

export async function getLastMarker(context: vscode.ExtensionContext): Promise<LastMarkerStatus | undefined> {
  return readJsonStatus<LastMarkerStatus>(context, GS.lastMarker, (p) => 'timestampMs' in p);
}

export async function setLastMarker(context: vscode.ExtensionContext, value: LastMarkerStatus): Promise<void> {
  await context.globalState.update(GS.lastMarker, JSON.stringify(value));
}

export async function getLastSync(context: vscode.ExtensionContext): Promise<LastSyncStatus | undefined> {
  return readJsonStatus<LastSyncStatus>(context, GS.lastSync, (p) => 'sent' in p);
}

export async function setLastSync(context: vscode.ExtensionContext, value: LastSyncStatus): Promise<void> {
  await context.globalState.update(GS.lastSync, JSON.stringify(value));
}

export async function setLastEventSent(context: vscode.ExtensionContext, value: LastEventSentStatus): Promise<void> {
  await context.globalState.update(GS.lastEventSent, JSON.stringify(value));
}

export async function getLastEventSent(context: vscode.ExtensionContext): Promise<LastEventSentStatus | undefined> {
  return readJsonStatus<LastEventSentStatus>(context, GS.lastEventSent, (p) => 'marker' in p);
}

export async function setLastLogDiscovery(
  context: vscode.ExtensionContext,
  value: LastLogDiscoveryStatus,
): Promise<void> {
  await context.globalState.update(GS.lastLogDiscovery, JSON.stringify(value));
}

export async function getLastLogDiscovery(
  context: vscode.ExtensionContext,
): Promise<LastLogDiscoveryStatus | undefined> {
  return readJsonStatus<LastLogDiscoveryStatus>(context, GS.lastLogDiscovery, (p) => 'path' in p);
}

export async function setLogFileLastWriteTime(context: vscode.ExtensionContext, mtimeMs: number): Promise<void> {
  await context.globalState.update(GS.logFileLastWriteTime, mtimeMs);
}

export async function getLogFileLastWriteTime(context: vscode.ExtensionContext): Promise<number | undefined> {
  const v = context.globalState.get<number>(GS.logFileLastWriteTime);
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function readJsonStatus<T>(
  context: vscode.ExtensionContext,
  key: string,
  validate: (p: Record<string, unknown>) => boolean,
): T | undefined {
  const raw = context.globalState.get<string>(key);
  if (!isNonEmptyString(raw)) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && validate(parsed as Record<string, unknown>)) {
      return parsed as T;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
