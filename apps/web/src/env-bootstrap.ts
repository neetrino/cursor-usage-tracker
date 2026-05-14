import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
config({ path: join(rootDir, '.env') });
config({ path: join(rootDir, '.env.local') });
