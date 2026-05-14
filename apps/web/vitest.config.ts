import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': join(rootDir, 'src'),
    },
  },
});
