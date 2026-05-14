export async function register(): Promise<void> {
  await import('./env-bootstrap');
  const { ensureSqlitePragmas } = await import('./server/db');
  await ensureSqlitePragmas();
}
