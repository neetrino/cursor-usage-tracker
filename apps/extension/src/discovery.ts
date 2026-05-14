import { homedir } from 'node:os';
import { join } from 'node:path';
import { readdir, stat } from 'node:fs/promises';

export async function discoverCursorWindowLogs(): Promise<string[]> {
  if (process.platform !== 'win32') {
    return [];
  }

  const root = join(homedir(), 'AppData', 'Roaming', 'Cursor', 'logs');
  const found: Array<{ path: string; mtimeMs: number }> = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
        continue;
      }
      if (!e.isFile()) continue;
      const lower = e.name.toLowerCase();
      if (!lower.startsWith('window')) continue;
      if (!lower.endsWith('.log')) continue;
      const s = await stat(p);
      found.push({ path: p, mtimeMs: s.mtimeMs });
    }
  }

  try {
    await walk(root);
  } catch {
    return [];
  }

  return found.sort((a, b) => b.mtimeMs - a.mtimeMs).map((x) => x.path);
}
