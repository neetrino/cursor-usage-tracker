import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type SqlitePragmaState = 'pending' | 'ok' | 'failed';
let sqlitePragmaState: SqlitePragmaState = 'pending';

async function applySqlitePragmas(client: PrismaClient): Promise<void> {
  if (sqlitePragmaState !== 'pending') return;
  try {
    // PRAGMA returns rows — use $queryRawUnsafe, not $executeRawUnsafe (SQLite + Prisma).
    await client.$queryRawUnsafe(`PRAGMA journal_mode=WAL`);
    await client.$queryRawUnsafe(`PRAGMA busy_timeout=5000`);
    sqlitePragmaState = 'ok';
  } catch (err) {
    sqlitePragmaState = 'failed';
    console.warn('[prisma] SQLite PRAGMA setup failed (non-fatal)', err);
  }
}

function createClient(): PrismaClient {
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function ensureSqlitePragmas(): Promise<void> {
  await applySqlitePragmas(prisma);
}
