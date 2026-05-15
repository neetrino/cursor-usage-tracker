/**
 * Avoid opening SQLite during `next build`. Coolify may pass production DATABASE_URL
 * (e.g. file:/data/...) at build time; /data is not mounted in the image builder.
 */
function isNextBuildProcess(): boolean {
  if (process.argv[2] !== 'build') return false;
  const bin = process.argv[1] ?? '';
  if (bin.includes('next')) return true;
  return process.env.npm_lifecycle_event === 'build';
}

export async function register(): Promise<void> {
  if (isNextBuildProcess()) {
    return;
  }
  if (!process.env.DATABASE_URL) {
    return;
  }
  const { ensureSqlitePragmas } = await import('./server/db');
  await ensureSqlitePragmas();
}
