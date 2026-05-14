import * as vscode from 'vscode';
import { mkdir } from 'node:fs/promises';
import {
  createLocalEventRawHash,
  normalizeRawLine,
  parseCursorLocalLogTimestampToMs,
  toUtcIso,
} from '@cursor-usage-tracker/shared';
import { discoverCursorWindowLogs } from './discovery';
import { detectMarker } from './markers';
import { readLastTextChunk, readNewLinesSinceByteOffset } from './logReader';
import { postTrackerEvents } from './sender';
import {
  enqueue,
  readQueue,
  writeQueue,
  getLogBytePosition,
  setLogBytePosition,
} from './storage';

let retryTimer: ReturnType<typeof setInterval> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration();
}

async function resolveLogPath(context: vscode.ExtensionContext): Promise<string | undefined> {
  const configured = cfg().get<string>('cursorUsageTracker.cursorLogPath', '')?.trim();
  if (configured) return configured;
  const discovered = await discoverCursorWindowLogs();
  return discovered[0];
}

async function buildPayload(
  line: string,
  marker: string,
): Promise<Record<string, string | number>> {
  const userKey = cfg().get<string>('cursorUsageTracker.userKey', '').trim();
  const userName = cfg().get<string>('cursorUsageTracker.userName', '').trim();
  const computerId = cfg().get<string>('cursorUsageTracker.computerId', '').trim();
  const owningUser = cfg().get<string>('cursorUsageTracker.owningUser', '').trim();

  const timestampMs = parseCursorLocalLogTimestampToMs(line);
  const normalized = normalizeRawLine(line);
  const rawLineHash = createLocalEventRawHash({
    userKey,
    computerId,
    owningUser,
    timestampMs,
    marker,
    normalizedRawLine: normalized,
  });

  return {
    userKey,
    userName,
    computerId,
    owningUser,
    timestampMs: Number(timestampMs),
    timestampUtc: toUtcIso(timestampMs),
    source: 'cursor_window_log',
    marker,
    rawLineHash,
  };
}

async function sendImmediate(context: vscode.ExtensionContext, payload: unknown): Promise<void> {
  const baseUrl = cfg().get<string>('cursorUsageTracker.backendUrl', '').trim().replace(/\/+$/, '');
  const apiKey = await context.secrets.get('cursorUsageTracker.apiKey');
  if (!baseUrl || !apiKey) {
    throw new Error('Missing backendUrl or tracker API key (run Setup).');
  }
  await postTrackerEvents({ baseUrl, apiKey, events: [payload] });
}

async function processLine(context: vscode.ExtensionContext, line: string): Promise<void> {
  const marker = detectMarker(line);
  if (!marker) return;

  const payload = await buildPayload(line, marker);
  try {
    await sendImmediate(context, payload);
  } catch {
    await enqueue(context, payload);
  }
}

async function tailOnce(context: vscode.ExtensionContext): Promise<void> {
  const logPath = await resolveLogPath(context);
  if (!logPath) return;

  const pos = await getLogBytePosition(context, logPath);
  const { nextOffset, lines } = await readNewLinesSinceByteOffset(logPath, pos);
  await setLogBytePosition(context, logPath, nextOffset);

  for (const line of lines) {
    await processLine(context, line);
  }
}

async function flushQueue(context: vscode.ExtensionContext): Promise<void> {
  const baseUrl = cfg().get<string>('cursorUsageTracker.backendUrl', '').trim().replace(/\/+$/, '');
  const apiKey = await context.secrets.get('cursorUsageTracker.apiKey');
  if (!baseUrl || !apiKey) return;

  const pending = await readQueue(context);
  if (pending.length === 0) return;

  const remaining: typeof pending = [];
  for (const item of pending) {
    try {
      await postTrackerEvents({ baseUrl, apiKey, events: [item.payload] });
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(context, remaining);
}

function disposeWatchers(): void {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = undefined;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  fileWatcher?.dispose();
  fileWatcher = undefined;
}

async function startWatchers(context: vscode.ExtensionContext): Promise<void> {
  disposeWatchers();

  const logPath = await resolveLogPath(context);
  if (!logPath) {
    return;
  }

  const uri = vscode.Uri.file(logPath);
  fileWatcher = vscode.workspace.createFileSystemWatcher(uri);
  fileWatcher.onDidChange(() => {
    void tailOnce(context);
  });
  context.subscriptions.push(fileWatcher);

  pollTimer = setInterval(() => {
    void tailOnce(context);
  }, 2000);

  retryTimer = setInterval(() => {
    void flushQueue(context);
  }, 60_000);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await mkdir(context.globalStorageUri.fsPath, { recursive: true });

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorUsageTracker.setup', async () => {
      const backendUrl = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — backend URL',
        prompt: 'Example: http://localhost:3000',
        value: cfg().get<string>('cursorUsageTracker.backendUrl', ''),
      });
      if (backendUrl === undefined) return;
      await cfg().update('cursorUsageTracker.backendUrl', backendUrl.trim(), vscode.ConfigurationTarget.Global);

      const apiKey = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — tracker API key',
        prompt: 'Matches server TRACKER_API_KEY',
        password: true,
      });
      if (apiKey === undefined) return;
      await context.secrets.store('cursorUsageTracker.apiKey', apiKey);

      const userKey = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — userKey',
        value: cfg().get<string>('cursorUsageTracker.userKey', ''),
      });
      if (userKey === undefined) return;
      await cfg().update('cursorUsageTracker.userKey', userKey.trim(), vscode.ConfigurationTarget.Global);

      const userName = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — userName',
        value: cfg().get<string>('cursorUsageTracker.userName', ''),
      });
      if (userName === undefined) return;
      await cfg().update('cursorUsageTracker.userName', userName.trim(), vscode.ConfigurationTarget.Global);

      const computerId = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — computerId',
        value: cfg().get<string>('cursorUsageTracker.computerId', ''),
      });
      if (computerId === undefined) return;
      await cfg().update('cursorUsageTracker.computerId', computerId.trim(), vscode.ConfigurationTarget.Global);

      const owningUser = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — owningUser',
        prompt: 'Must match Cursor usage JSON owningUser for this machine/user',
        value: cfg().get<string>('cursorUsageTracker.owningUser', ''),
      });
      if (owningUser === undefined) return;
      await cfg().update('cursorUsageTracker.owningUser', owningUser.trim(), vscode.ConfigurationTarget.Global);

      const group = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — cursorAccountGroup (optional)',
        value: cfg().get<string>('cursorUsageTracker.cursorAccountGroup', ''),
      });
      if (group === undefined) return;
      await cfg().update('cursorUsageTracker.cursorAccountGroup', group.trim(), vscode.ConfigurationTarget.Global);

      const logPath = await vscode.window.showInputBox({
        title: 'Cursor Usage Tracker — cursorLogPath (optional)',
        prompt: 'Leave empty to auto-discover on Windows',
        value: cfg().get<string>('cursorUsageTracker.cursorLogPath', ''),
      });
      if (logPath === undefined) return;
      await cfg().update('cursorUsageTracker.cursorLogPath', logPath.trim(), vscode.ConfigurationTarget.Global);

      await startWatchers(context);
      vscode.window.showInformationMessage('Cursor Usage Tracker: setup saved.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorUsageTracker.setLogPath', async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        title: 'Select Cursor Window log file',
        filters: { Logs: ['log'] },
      });
      if (!picked?.[0]) return;
      await cfg().update(
        'cursorUsageTracker.cursorLogPath',
        picked[0].fsPath,
        vscode.ConfigurationTarget.Global,
      );
      await startWatchers(context);
      vscode.window.showInformationMessage(`Cursor Usage Tracker: log path set to ${picked[0].fsPath}`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorUsageTracker.testLogDetection', async () => {
      const logPath = await resolveLogPath(context);
      if (!logPath) {
        vscode.window.showWarningMessage('No Cursor log path configured or discovered.');
        return;
      }
      const chunk = await readLastTextChunk(logPath, 96 * 1024);
      const hits = chunk
        .split(/\r?\n/)
        .map((l) => ({ line: l, marker: detectMarker(l) }))
        .filter((x) => x.marker !== null);
      vscode.window.showInformationMessage(
        `Cursor Usage Tracker: scanned last ~96KB, marker hits=${hits.length} (${logPath})`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorUsageTracker.showPending', async () => {
      const q = await readQueue(context);
      vscode.window.showInformationMessage(`Cursor Usage Tracker: pending queued events=${q.length}`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorUsageTracker.syncNow', async () => {
      await flushQueue(context);
      vscode.window.showInformationMessage('Cursor Usage Tracker: queue flush attempted.');
    }),
  );

  context.subscriptions.push(
    new vscode.Disposable(() => {
      disposeWatchers();
    }),
  );

  await startWatchers(context);
}

export function deactivate(): void {
  disposeWatchers();
}
