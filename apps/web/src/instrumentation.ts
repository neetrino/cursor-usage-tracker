export async function register(): Promise<void> {
  // Docker/Coolify `next build` has no DATABASE_URL in the builder image; skip DB init.
  if (!process.env.DATABASE_URL) {
    return;
  }
  const { ensureSqlitePragmas } = await import('./server/db');
  await ensureSqlitePragmas();
}
