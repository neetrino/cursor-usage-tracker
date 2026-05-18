import { existsSync, statSync } from 'node:fs';
import type * as vscode from 'vscode';
import { discoverCursorLogFiles } from './logDiscovery';
import { loadPublicSettings, saveCursorLogPath, setLastLogDiscovery } from './config';
import { asString, isNonEmptyString } from './stringUtil';

const DISCOVERY_INTERVAL_MS = 45_000;

let lastDiscoveryAt = 0;

export async function refreshActiveLogPath(
  context: vscode.ExtensionContext,
  force = false,
): Promise<string | undefined> {
  const now = Date.now();
  if (!force && now - lastDiscoveryAt < DISCOVERY_INTERVAL_MS) {
    const settings = loadPublicSettings(context);
    const saved = asString(settings.cursorLogPath).trim();
    if (isNonEmptyString(saved) && fileExists(saved)) {
      return saved;
    }
  }

  lastDiscoveryAt = now;
  const found = await discoverCursorLogFiles();
  const best = found[0]?.path;
  if (!isNonEmptyString(best)) {
    const settings = loadPublicSettings(context);
    const saved = asString(settings.cursorLogPath).trim();
    return isNonEmptyString(saved) && fileExists(saved) ? saved : undefined;
  }

  const settings = loadPublicSettings(context);
  const current = asString(settings.cursorLogPath).trim();
  if (current !== best) {
    await saveCursorLogPath(context, best);
  }

  let mtimeMs = 0;
  try {
    mtimeMs = statSync(best).mtimeMs;
  } catch {
    mtimeMs = 0;
  }

  await setLastLogDiscovery(context, {
    atIso: new Date().toISOString(),
    path: best,
    mtimeMs,
  });

  return best;
}

function fileExists(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile();
  } catch {
    return false;
  }
}
