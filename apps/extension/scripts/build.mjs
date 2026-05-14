import esbuild from 'esbuild';
import { mkdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
await mkdir('out', { recursive: true });

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
} else {
  await esbuild.build(buildOptions);
}
