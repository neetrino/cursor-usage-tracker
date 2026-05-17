import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
config({ path: join(rootDir, '.env') });
config({ path: join(rootDir, '.env.local') });

const { prisma } = await import('../../web/src/server/db.ts');
const { runMatchingPass } = await import('../../web/src/server/matching/runMatching.ts');

const ONE_HOUR_MS = 60 * 60 * 1000;

async function tick(): Promise<void> {
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
}, ONE_HOUR_MS);
