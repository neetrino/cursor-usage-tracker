import { randomBytes } from 'node:crypto';
import { userInfo } from 'node:os';
import { existsSync, statSync } from 'node:fs';
import * as vscode from 'vscode';
import {
  clearPublicSettings,
  clearStatusSnapshots,
  clearTrackerApiKey,
  getTrackerApiKey,
  hasTrackerApiKey,
  savePublicSettings,
  setLastBackendCheck,
  storeTrackerApiKey,
  type ExtensionPublicSettings,
} from './config';
import { testBackendConnection } from './backendClient';
import { discoverCursorLogFiles, testLogDetection } from './logDiscovery';
import { clearPendingQueue, flushPendingQueue } from './queue';
import {
  buildWebviewState,
  validateSaveForm,
  type NormalizedSaveFormInput,
} from './settingsWebviewState';
import { asString, asUiMessage, isNonEmptyString } from './stringUtil';
import { logDiagnosticError } from './diagnosticChannel';

export function suggestedComputerId(): string {
  const raw =
    process.platform === 'win32' ? (process.env.USERNAME ?? userInfo().username) : userInfo().username;
  const safe = String(raw)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
  const userPart = safe.length > 0 ? safe : 'user';
  const suffix = randomBytes(3).toString('hex');
  return `pc-${userPart}-${suffix}`;
}

function readFormRecord(msg: unknown): Record<string, unknown> | undefined {
  if (!msg || typeof msg !== 'object' || !('form' in msg)) return undefined;
  const form = (msg as { form?: unknown }).form;
  if (form === null || typeof form !== 'object') return undefined;
  return form as Record<string, unknown>;
}

function mergeCursorAccountGroup(cursorAccountGroupSel: string, customCursorAccountGroup: string): string {
  const modeRaw = asString(cursorAccountGroupSel).trim();
  const mode =
    modeRaw === 'ultra_1' || modeRaw === 'ultra_2' || modeRaw === 'custom' ? modeRaw : 'ultra_1';
  const custom = asString(customCursorAccountGroup).trim();
  if (mode === 'custom') {
    return isNonEmptyString(custom) ? custom : '';
  }
  return mode;
}

function normalizedSavePayload(p: Record<string, unknown>): NormalizedSaveFormInput {
  return {
    backendUrl: asString(p.backendUrl).trim(),
    trackerApiKey: asString(p.trackerApiKey).trim(),
    userKey: asString(p.userKey).trim(),
    userName: asString(p.userName).trim(),
    computerId: asString(p.computerId).trim(),
    owningUser: asString(p.owningUser).trim(),
    cursorAccountGroup: mergeCursorAccountGroup(
      asString(p.cursorAccountGroup),
      asString(p.customCursorAccountGroup),
    ),
    cursorLogPath: asString(p.cursorLogPath).trim(),
  };
}

async function pushState(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<void> {
  panel.webview.postMessage({ type: 'applyState', state: await buildWebviewState(context) });
}

function postGeneratedId(panel: vscode.WebviewPanel): void {
  panel.webview.postMessage({ type: 'setField', field: 'computerId', value: suggestedComputerId() });
}

async function browseLogFile(panel: vscode.WebviewPanel): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    title: 'Select Cursor log file',
    filters: { Logs: ['log'], 'All': ['*'] },
  });
  if (!picked || picked.length === 0) {
    vscode.window.showInformationMessage('Cursor log path setup cancelled.');
    return;
  }
  const fsPath = picked[0]?.fsPath;
  if (!isNonEmptyString(fsPath)) {
    vscode.window.showInformationMessage('Cursor log path setup cancelled.');
    return;
  }
  panel.webview.postMessage({ type: 'setField', field: 'cursorLogPath', value: asString(fsPath).trim() });
}

async function autoDiscoverLog(panel: vscode.WebviewPanel): Promise<void> {
  const found = await discoverCursorLogFiles();
  if (found.length === 0) {
    vscode.window.showWarningMessage('No Cursor log files found under %APPDATA%\\Cursor\\logs (Windows).');
    return;
  }
  if (found.length === 1) {
    panel.webview.postMessage({ type: 'setField', field: 'cursorLogPath', value: asString(found[0].path) });
    vscode.window.showInformationMessage('Log path filled from discovery (not saved until you click Save).');
    return;
  }
  const picked = await vscode.window.showQuickPick(
    found.map((f) => ({
      label: f.path,
      description: `mtime ${new Date(f.mtimeMs).toISOString()} · ~markers ${f.markerCountApprox}`,
      path: f.path,
    })),
    { placeHolder: 'Choose a Cursor log file' },
  );
  if (!picked || typeof picked !== 'object' || !('path' in picked)) return;
  panel.webview.postMessage({
    type: 'setField',
    field: 'cursorLogPath',
    value: asString((picked as { path: unknown }).path).trim(),
  });
}

async function runTestLog(panel: vscode.WebviewPanel, msg: unknown): Promise<void> {
  const path = asString((msg as { path?: unknown }).path).trim();
  if (!isNonEmptyString(path)) {
    panel.webview.postMessage({ type: 'toast', message: 'Set a log file path first.', isError: true });
    return;
  }
  if (!existsSync(path) || !statSync(path).isFile()) {
    panel.webview.postMessage({ type: 'toast', message: 'Log path must be an existing file.', isError: true });
    return;
  }
  const res = await testLogDetection(path);
  if (res.ok) {
    panel.webview.postMessage({
      type: 'toast',
      message: asUiMessage(
        `Marker found: ${res.markerType} @ ${res.timestampUtc} (ms=${res.timestampMs})`,
        'Marker found.',
      ),
      isError: false,
    });
  } else {
    panel.webview.postMessage({
      type: 'toast',
      message: asUiMessage(res.reason, 'Log test failed.'),
      isError: true,
    });
  }
}

async function runTestBackend(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  msg: unknown,
): Promise<void> {
  const p = readFormRecord(msg);
  if (!p) {
    panel.webview.postMessage({ type: 'toast', message: 'Invalid form data.', isError: true });
    return;
  }
  const n = normalizedSavePayload(p);
  const fromSecret = (await getTrackerApiKey(context)) ?? '';
  const apiKey = isNonEmptyString(n.trackerApiKey) ? n.trackerApiKey : fromSecret;
  if (!isNonEmptyString(apiKey)) {
    panel.webview.postMessage({
      type: 'toast',
      message: 'Enter tracker API key in the form or save one first.',
      isError: true,
    });
    return;
  }
  const result = await testBackendConnection({ baseUrl: n.backendUrl, apiKey });
  if (result.ok) {
    const serviceLabel = asUiMessage(result.body.service, 'unknown');
    await setLastBackendCheck(context, {
      ok: true,
      message: `Health OK (${serviceLabel})`,
      atIso: new Date().toISOString(),
    });
    panel.webview.postMessage({ type: 'toast', message: 'Backend connection OK.', isError: false });
  } else {
    const failText = asUiMessage(result.message, 'Backend check failed.');
    await setLastBackendCheck(context, {
      ok: false,
      message: failText,
      atIso: new Date().toISOString(),
    });
    panel.webview.postMessage({ type: 'toast', message: failText, isError: true });
  }
  await pushState(context, panel);
}

async function runSyncPending(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  onSettingsChanged: () => void | Promise<void>,
): Promise<void> {
  const r = await flushPendingQueue(context);
  await onSettingsChanged();
  panel.webview.postMessage({
    type: 'toast',
    message: asUiMessage(
      `Sync: sent=${r.sent} failed=${r.failed} remaining=${r.remaining}`,
      'Sync finished.',
    ),
    isError: r.failed > 0,
  });
  await pushState(context, panel);
}

async function runClearQueue(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): Promise<void> {
  const ok = await vscode.window.showWarningMessage(
    'Clear the local pending retry queue? (Backend data is not affected.)',
    { modal: true },
    'Clear',
  );
  if (ok !== 'Clear') return;
  await clearPendingQueue(context);
  panel.webview.postMessage({ type: 'toast', message: 'Pending queue cleared.', isError: false });
  await pushState(context, panel);
}

async function runReset(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  onSettingsChanged: () => void | Promise<void>,
): Promise<void> {
  const ok = await vscode.window.showWarningMessage(
    'Reset all extension settings and the stored tracker API key? The pending queue is not cleared.',
    { modal: true },
    'Reset',
  );
  if (ok !== 'Reset') return;
  await clearPublicSettings(context);
  await clearTrackerApiKey(context);
  await clearStatusSnapshots(context);
  await onSettingsChanged();
  panel.webview.postMessage({ type: 'toast', message: 'Settings reset.', isError: false });
  await pushState(context, panel);
  vscode.window.showInformationMessage('Cursor Usage Tracker: settings reset.');
}

async function runSave(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  msg: unknown,
  onSettingsChanged: () => void | Promise<void>,
): Promise<void> {
  const p = readFormRecord(msg);
  if (!p) {
    panel.webview.postMessage({ type: 'toast', message: 'Invalid form data.', isError: true });
    vscode.window.showErrorMessage('Cursor Usage Tracker: invalid form data.');
    return;
  }
  const normalized = normalizedSavePayload(p);
  const existing = await hasTrackerApiKey(context);
  const errors = validateSaveForm(normalized, existing);
  if (errors.length > 0) {
    panel.webview.postMessage({ type: 'validationErrors', errors });
    return;
  }
  const publicSettings: ExtensionPublicSettings = {
    backendUrl: normalized.backendUrl,
    userKey: normalized.userKey,
    userName: normalized.userName,
    computerId: normalized.computerId,
    owningUser: normalized.owningUser,
    cursorAccountGroup: normalized.cursorAccountGroup,
    cursorLogPath: normalized.cursorLogPath,
  };
  await savePublicSettings(context, publicSettings);
  if (isNonEmptyString(normalized.trackerApiKey)) {
    await storeTrackerApiKey(context, normalized.trackerApiKey);
  }
  await onSettingsChanged();
  panel.webview.postMessage({ type: 'toast', message: 'Settings saved.', isError: false });
  await pushState(context, panel);
  vscode.window.showInformationMessage('Cursor Usage Tracker: settings saved.');
}

export async function handleSettingsWebviewMessage(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  msg: unknown,
  onSettingsChanged: () => void | Promise<void>,
): Promise<void> {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
  const type = asString((msg as { type?: unknown }).type);
  if (!type) return;

  try {
    switch (type) {
      case 'generateComputerId':
        postGeneratedId(panel);
        break;
      case 'browseFile':
        await browseLogFile(panel);
        break;
      case 'autoDiscover':
        await autoDiscoverLog(panel);
        break;
      case 'testLog':
        await runTestLog(panel, msg);
        break;
      case 'testBackend':
        await runTestBackend(context, panel, msg);
        break;
      case 'syncPending':
        await runSyncPending(context, panel, onSettingsChanged);
        break;
      case 'clearQueue':
        await runClearQueue(context, panel);
        break;
      case 'reset':
        await runReset(context, panel, onSettingsChanged);
        break;
      case 'save':
        await runSave(context, panel, msg, onSettingsChanged);
        break;
      default:
        break;
    }
  } catch (e) {
    logDiagnosticError(`handleSettingsWebviewMessage:${type}`, e);
    const message = asUiMessage(e instanceof Error ? e.message : String(e), 'Unexpected error');
    panel.webview.postMessage({
      type: 'toast',
      message,
      isError: true,
    });
    vscode.window.showErrorMessage(`Cursor Usage Tracker: ${message}`);
  }
}
