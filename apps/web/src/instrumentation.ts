export async function register(): Promise<void> {
  const { ensureSqlitePragmas } = await import('./server/db');
  await ensureSqlitePragmas();
}
