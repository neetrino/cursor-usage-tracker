import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { readdir, stat, readFile } from 'node:fs/promises';
import { detectCanonicalMarker, detectDiagnosticMarker } from './markers';
import { readLastTextChunk } from './logReader';
import {
  parseCursorLocalLogTimestampToMs,
  toUtcIso,
} from '@cursor-usage-tracker/shared';
import { asString } from './stringUtil';
import { debugTrace } from './debugTrace';
import { logDiagnosticError } from './diagnosticChannel';

export type DiscoveredLogFile = {
  path: string;
  mtimeMs: number;
  markerCountApprox: number;
};

function isPreferredRendererLog(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.includes('window') && lower.endsWith('renderer.log');
}

async function walkLogFiles(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const entryName = typeof e.name === 'string' ? e.name : '';
      if (!entryName) continue;
      const p = join(dir, entryName);
      if (e.isDirectory()) {
        await walk(p);
        continue;
      }
      if (!e.isFile()) continue;
      if (!entryName.toLowerCase().endsWith('.log')) continue;
      if (!isPreferredRendererLog(p)) continue;
      out.push(p);
    }
  }

  try {
    await walk(root);
  } catch {
    return [];
  }
  return out;
}

function countCanonicalMarkersInText(text: string): number {
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    if (detectCanonicalMarker(line)) n += 1;
  }
  return n;
}

export async function discoverCursorLogFiles(options?: {
  maxPaths?: number;
  tailBytes?: number;
}): Promise<DiscoveredLogFile[]> {
  if (process.platform !== 'win32') {
    return [];
  }
  const maxPaths = options?.maxPaths ?? 120;
  const tailBytes = options?.tailBytes ?? 512 * 1024;

  const root = join(homedir(), 'AppData', 'Roaming', 'Cursor', 'logs');
  const paths = await walkLogFiles(root);
  const stats: Array<{ path: string; mtimeMs: number }> = [];
  for (const path of paths) {
    try {
      const s = await stat(path);
      stats.push({ path, mtimeMs: s.mtimeMs });
    } catch {
      continue;
    }
  }
  stats.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const top = stats.slice(0, maxPaths);

  const scored: DiscoveredLogFile[] = [];
  for (const f of top) {
    let markerCountApprox = 0;
    try {
      const buf = await readFile(f.path);
      const slice = buf.subarray(Math.max(0, buf.length - tailBytes));
      markerCountApprox = countCanonicalMarkersInText(slice.toString('utf8'));
    } catch {
      markerCountApprox = 0;
    }
    scored.push({
      path: f.path,
      mtimeMs: f.mtimeMs,
      markerCountApprox,
    });
  }

  scored.sort((a, b) => {
    if (b.markerCountApprox !== a.markerCountApprox) {
      return b.markerCountApprox - a.markerCountApprox;
    }
    return b.mtimeMs - a.mtimeMs;
  });
  return scored;
}

export type LogDetectionTestResult =
  | {
      ok: true;
      marker: string;
      markerType: 'buildRequestedModel' | 'wakelock_acquired';
      timestampMs: number;
      timestampUtc: string;
    }
  | { ok: false; reason: string };

export async function testLogDetection(logPath: string, tailBytes = 96 * 1024): Promise<LogDetectionTestResult> {
  const safePath = asString(logPath).trim();
  debugTrace('testLogDetection:enter', {
    logBasename: basename(safePath),
    pathLen: safePath.length,
    tailKb: Math.round(tailBytes / 1024),
  });
  try {
    const chunk = await readLastTextChunk(safePath, tailBytes);
    const lines = chunk.split(/\r?\n/);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const lineStr = asString(lines[i]);
      if (detectCanonicalMarker(lineStr)) {
        const timestampMs = parseCursorLocalLogTimestampToMs(lineStr);
        const timestampUtc = toUtcIso(timestampMs);
        return {
          ok: true,
          marker: '[buildRequestedModel]',
          markerType: 'buildRequestedModel',
          timestampMs,
          timestampUtc,
        };
      }
    }
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const lineStr = asString(lines[i]);
      const diagnostic = detectDiagnosticMarker(lineStr);
      if (diagnostic === 'wakelock_acquired') {
        const timestampMs = parseCursorLocalLogTimestampToMs(lineStr);
        const timestampUtc = toUtcIso(timestampMs);
        return {
          ok: true,
          marker: '[ComposerWakelockManager] Acquired wakelock reason="agent-loop"',
          markerType: 'wakelock_acquired',
          timestampMs,
          timestampUtc,
        };
      }
    }
    return {
      ok: false,
      reason: `No marker found in last ${Math.round(tailBytes / 1024)}KB (looked for [buildRequestedModel] or Composer wakelock agent-loop).`,
    };
  } catch (e) {
    logDiagnosticError('testLogDetection', e);
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: message };
  }
}
