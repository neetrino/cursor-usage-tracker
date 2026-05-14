import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type * as vscode from 'vscode';

export type QueuedEvent = {
  payload: unknown;
  createdAtIso: string;
};

export function queueFilePath(context: vscode.ExtensionContext): string {
  return join(context.globalStorageUri.fsPath, 'pending-events.json');
}

export async function readQueue(context: vscode.ExtensionContext): Promise<QueuedEvent[]> {
  try {
    const raw = await readFile(queueFilePath(context), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as QueuedEvent[];
  } catch {
    return [];
  }
}

export async function writeQueue(context: vscode.ExtensionContext, items: QueuedEvent[]): Promise<void> {
  await writeFile(queueFilePath(context), JSON.stringify(items, null, 2), 'utf8');
}

export async function enqueue(context: vscode.ExtensionContext, payload: unknown): Promise<void> {
  const q = await readQueue(context);
  q.push({ payload, createdAtIso: new Date().toISOString() });
  await writeQueue(context, q);
}

export async function dequeueAll(context: vscode.ExtensionContext): Promise<QueuedEvent[]> {
  const q = await readQueue(context);
  await writeQueue(context, []);
  return q;
}

export async function getLogBytePosition(
  context: vscode.ExtensionContext,
  logPath: string,
): Promise<number> {
  const key = `logOffset:${logPath}`;
  const stored = context.globalState.get<number>(key);
  if (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0) {
    return stored;
  }
  const s = await stat(logPath);
  return s.size;
}

export async function setLogBytePosition(
  context: vscode.ExtensionContext,
  logPath: string,
  pos: number,
): Promise<void> {
  const key = `logOffset:${logPath}`;
  await context.globalState.update(key, pos);
}
