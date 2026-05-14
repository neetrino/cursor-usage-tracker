import * as vscode from 'vscode';
import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import {
  createLocalEventRawHash,
  normalizeRawLine,
  parseCursorLocalLogTimestampToMs,
  toUtcIso,
} from '@cursor-usage-tracker/shared';
import { postTrackerEvents } from './backendClient';
import { discoverCursorLogFiles, testLogDetection } from './logDiscovery';
import { detectMarker } from './markers';
import { readNewLinesSinceByteOffset } from './logReader';
import { flushPendingQueue, getPendingCount } from './queue';
import {
  getTrackerApiKey,
  loadPublicSettings,
  saveCursorLogPath,
  setLastMarker,
} from './config';
import { enqueue, getLogBytePosition, setLogBytePosition } from './storage';
import { openPendingJsonPreview, openSettingsWebview } from './settingsWebview';
import { asString, asUiMessage, isNonEmptyString } from './stringUtil';
import { debugTrace, isDebugTraceEnabled } from './debugTrace';
import { getDiagnosticChannel, logDiagnosticError, runWithDiagnostics, runWithDiagnosticsSync } from './diagnosticChannel';

let retryTimer: ReturnType<typeof setInterval> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

async function resolveLogPath(context: vscode.ExtensionContext): Promise<string | undefined> {
  const settings = loadPublicSettings(context);
  const logPath = asString(settings.cursorLogPath).trim();
  if (isNonEmptyString(logPath)) {
    return logPath;
  }
  const found = await discoverCursorLogFiles();
  return found[0]?.path;
}

async function buildPayload(
  context: vscode.ExtensionContext,
  line: string,
  marker: 'buildRequestedModel' | 'wakelock_acquired',
): Promise<Record<string, string | number>> {
  try {
    const settings = loadPublicSettings(context);
    const userKey = asString(settings.userKey).trim();
    const userName = asString(settings.userName).trim();
    const computerId = asString(settings.computerId).trim();
    const owningUser = asString(settings.owningUser).trim();

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
  } catch (error) {
    logDiagnosticError('buildPayload', error);
    throw error;
  }
}

async function sendImmediate(context: vscode.ExtensionContext, payload: unknown): Promise<void> {
  const settings = loadPublicSettings(context);
  const baseUrl = asString(settings.backendUrl).trim().replace(/\/+$/, '');
  const apiKey = await getTrackerApiKey(context);
  if (!baseUrl || !apiKey) {
    throw new Error('Missing backendUrl or tracker API key (open Settings).');
  }
  await postTrackerEvents({ baseUrl, apiKey, events: [payload] });
}

async function processLine(context: vscode.ExtensionContext, line: string): Promise<void> {
  if (typeof line !== 'string') {
    debugTrace('processLine:invalidLine', {
      lineType: typeof line,
      lineIsNullish: line == null,
    });
    return;
  }

  try {
    const marker = detectMarker(line);
    if (!marker) return;

    const payload = await buildPayload(context, line, marker);
    const markerLabel =
      marker === 'buildRequestedModel'
        ? '[buildRequestedModel]'
        : '[ComposerWakelockManager] Acquired wakelock reason="agent-loop"';

    await setLastMarker(context, {
      marker: markerLabel,
      markerType: marker,
      timestampMs: Number(payload.timestampMs),
      timestampUtc: String(payload.timestampUtc),
      atIso: new Date().toISOString(),
    });

    try {
      await sendImmediate(context, payload);
    } catch {
      await enqueue(context, payload);
    }
  } catch (error) {
    logDiagnosticError('processLine', error);
    throw error;
  }
}

async function tailOnce(context: vscode.ExtensionContext): Promise<void> {
  try {
    const logPath = await resolveLogPath(context);
    if (!logPath) return;

    const pos = await getLogBytePosition(context, logPath);
    const { nextOffset, lines } = await readNewLinesSinceByteOffset(logPath, pos);
    await setLogBytePosition(context, logPath, nextOffset);

    if (isDebugTraceEnabled() && lines.length > 0) {
      const first = lines[0];
      debugTrace('tailOnce:lines', {
        count: lines.length,
        firstType: typeof first,
        firstLen: typeof first === 'string' ? first.length : -1,
        nextOffset,
      });
    }

    for (const line of lines) {
      await processLine(context, line);
    }
  } catch (error) {
    logDiagnosticError('tailOnce', error);
    throw error;
  }
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
  try {
    disposeWatchers();

    const logPath = await resolveLogPath(context);
    if (!logPath) {
      return;
    }

    fileWatcher = vscode.workspace.createFileSystemWatcher(logPath);
    fileWatcher.onDidChange(() => {
      void runWithDiagnostics('tailOnce:onDidChange', () => tailOnce(context));
    });
    context.subscriptions.push(fileWatcher);

    pollTimer = setInterval(() => {
      void runWithDiagnostics('tailOnce:poll', () => tailOnce(context));
    }, 2000);

    retryTimer = setInterval(() => {
      void runWithDiagnostics('flushPendingQueue:interval', () => flushPendingQueue(context));
    }, 60_000);
  } catch (error) {
    logDiagnosticError('startWatchers', error);
    throw error;
  }
}

function registerOpenSettings(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('cursorUsageTracker.openSettings', () => {
    runWithDiagnosticsSync('command:openSettings', () => {
      openSettingsWebview(context, () => startWatchers(context));
    });
  });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    new vscode.Disposable(() => {
      getDiagnosticChannel().dispose();
    }),
  );

  try {
    if (isDebugTraceEnabled()) {
      debugTrace('activate', {
        globalStorageFsPathLen: context.globalStorageUri.fsPath.length,
        debug: true,
      });
    }

    await mkdir(context.globalStorageUri.fsPath, { recursive: true });

    const refreshWatchers = () => startWatchers(context);

    context.subscriptions.push(registerOpenSettings(context));

    context.subscriptions.push(
      vscode.commands.registerCommand('cursorUsageTracker.setup', () => {
        runWithDiagnosticsSync('command:setup', () => {
          openSettingsWebview(context, refreshWatchers);
        });
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cursorUsageTracker.setLogPath', async () => {
        try {
          const picked = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            title: 'Select Cursor Window log file',
            filters: { 'Log files': ['log'], 'All files': ['*'] },
          });

        if (!picked || picked.length === 0) {
          vscode.window.showInformationMessage('Cursor log path setup cancelled.');
          return;
        }

        const logPathRaw = picked[0]?.fsPath;
        if (!isNonEmptyString(logPathRaw)) {
          vscode.window.showInformationMessage('Cursor log path setup cancelled.');
          return;
        }

        const logPath = asString(logPathRaw).trim();

        if (!existsSync(logPath)) {
          vscode.window.showErrorMessage('Cursor log file does not exist.');
          return;
        }

        let isFile = false;
        try {
          isFile = statSync(logPath).isFile();
        } catch {
          vscode.window.showErrorMessage('Cursor log file does not exist.');
          return;
        }

        if (!isFile) {
          vscode.window.showErrorMessage('Cursor log path must be a file, not a directory.');
          return;
        }

        await saveCursorLogPath(context, logPath);
        await startWatchers(context);
        vscode.window.showInformationMessage(
          asUiMessage(`Cursor Usage Tracker: log path set to ${logPath}`, 'Cursor Usage Tracker: log path saved.'),
        );
        } catch (err) {
          logDiagnosticError('command:setLogPath', err);
          const message = asUiMessage(
            err instanceof Error ? err.message : String(err),
            'Unknown error',
          );
          vscode.window.showErrorMessage(`Cursor Usage Tracker: could not set log path (${message}).`);
        }
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cursorUsageTracker.testLogDetection', async () => {
        await runWithDiagnostics('command:testLogDetection', async () => {
          const logPath = await resolveLogPath(context);
          debugTrace('command:testLogDetection', {
            hasLogPath: Boolean(logPath),
            logPathLen: typeof logPath === 'string' ? logPath.length : 0,
          });
          if (!logPath) {
            vscode.window.showWarningMessage('No Cursor log path configured or discovered.');
            return;
          }
          const res = await testLogDetection(logPath);
          if (res.ok) {
            vscode.window.showInformationMessage(
              asUiMessage(
                `Cursor Usage Tracker: marker=${res.markerType} @ ${res.timestampUtc} (ms=${res.timestampMs})`,
                'Cursor Usage Tracker: marker found.',
              ),
            );
          } else {
            vscode.window.showWarningMessage(
              `Cursor Usage Tracker: ${asUiMessage(res.reason, 'Log test failed.')}`,
            );
          }
        });
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cursorUsageTracker.showPending', async () => {
        await runWithDiagnostics('command:showPending', async () => {
          const n = await getPendingCount(context);
          await openPendingJsonPreview(context);
          vscode.window.showInformationMessage(
            asUiMessage(
              `Cursor Usage Tracker: pending queued events=${n}`,
              'Cursor Usage Tracker: pending queue opened.',
            ),
          );
        });
      }),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('cursorUsageTracker.syncNow', async () => {
        await runWithDiagnostics('command:syncNow', async () => {
          const r = await flushPendingQueue(context);
          vscode.window.showInformationMessage(
            asUiMessage(
              `Cursor Usage Tracker: sync sent=${r.sent} failed=${r.failed} remaining=${r.remaining}`,
              'Cursor Usage Tracker: sync finished.',
            ),
          );
        });
      }),
    );

    context.subscriptions.push(
      new vscode.Disposable(() => {
        disposeWatchers();
      }),
    );

    await runWithDiagnostics('activate:startWatchers', () => startWatchers(context));
  } catch (error) {
    logDiagnosticError('activate', error);
    throw error;
  }
}

export function deactivate(): void {
  disposeWatchers();
}
