import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
config({ path: join(rootDir, '.env') });
config({ path: join(rootDir, '.env.local') });

const { performCursorUsageSync } = await import('../../web/src/server/cursor-usage-sync.ts');
const { prisma } = await import('../../web/src/server/db.ts');
const { runMatchingPass } = await import('../../web/src/server/matching/runMatching.ts');

const TEN_MIN_MS = 10 * 60 * 1000;

async function tick(): Promise<void> {
  const enabled = (process.env.CURSOR_USAGE_SYNC_ENABLED ?? 'false').toLowerCase() === 'true';
  if (enabled) {
    try {
      await performCursorUsageSync();
    } catch (e) {
      console.error('[worker] Cursor usage sync failed', e);
    }
  }

  try {
    const result = await runMatchingPass(prisma);
    console.log(`[worker] Matching pass updated=${result.updated}`);
  } catch (e) {
    console.error('[worker] Matching failed', e);
  }
}

const once = process.argv.includes('--once');

await tick();
if (once) {
  await prisma.$disconnect();
  process.exit(0);
}

setInterval(() => {
  void tick();
}, TEN_MIN_MS);
