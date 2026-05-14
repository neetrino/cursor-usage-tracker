import * as vscode from 'vscode';
import { asString, isNonEmptyString } from './stringUtil';

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

export async function hasTrackerApiKey(context: vscode.ExtensionContext): Promise<boolean> {
  const key = await getTrackerApiKey(context);
  return isNonEmptyString(key);
}

export async function getTrackerApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const primary = await context.secrets.get(SECRET_TRACKER_KEY);
  const primaryStr = asString(primary).trim();
  if (isNonEmptyString(primaryStr)) {
    return primaryStr;
  }
  const legacy = await context.secrets.get(SECRET_LEGACY_API_KEY);
  const legacyStr = asString(legacy).trim();
  if (isNonEmptyString(legacyStr)) {
    return legacyStr;
  }
  return undefined;
}

export async function storeTrackerApiKey(context: vscode.ExtensionContext, apiKey: string): Promise<void> {
  await context.secrets.store(SECRET_TRACKER_KEY, asString(apiKey).trim());
  await context.secrets.delete(SECRET_LEGACY_API_KEY);
}

export async function clearTrackerApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_TRACKER_KEY);
  await context.secrets.delete(SECRET_LEGACY_API_KEY);
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
  await context.globalState.update(GS.lastBackendCheck, undefined);
  await context.globalState.update(GS.lastMarker, undefined);
  await context.globalState.update(GS.lastSync, undefined);
}

export async function getLastBackendCheck(context: vscode.ExtensionContext): Promise<LastBackendCheck | undefined> {
  const raw = context.globalState.get<string>(GS.lastBackendCheck);
  if (!isNonEmptyString(raw)) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'ok' in parsed &&
      typeof (parsed as { ok?: unknown }).ok === 'boolean'
    ) {
      return parsed as LastBackendCheck;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function setLastBackendCheck(context: vscode.ExtensionContext, value: LastBackendCheck): Promise<void> {
  await context.globalState.update(GS.lastBackendCheck, JSON.stringify(value));
}

export async function getLastMarker(context: vscode.ExtensionContext): Promise<LastMarkerStatus | undefined> {
  const raw = context.globalState.get<string>(GS.lastMarker);
  if (!isNonEmptyString(raw)) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'timestampMs' in parsed) {
      return parsed as LastMarkerStatus;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function setLastMarker(context: vscode.ExtensionContext, value: LastMarkerStatus): Promise<void> {
  await context.globalState.update(GS.lastMarker, JSON.stringify(value));
}

export async function getLastSync(context: vscode.ExtensionContext): Promise<LastSyncStatus | undefined> {
  const raw = context.globalState.get<string>(GS.lastSync);
  if (!isNonEmptyString(raw)) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'sent' in parsed) {
      return parsed as LastSyncStatus;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function setLastSync(context: vscode.ExtensionContext, value: LastSyncStatus): Promise<void> {
  await context.globalState.update(GS.lastSync, JSON.stringify(value));
}
