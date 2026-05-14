import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/schemas.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
