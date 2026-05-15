import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type SqlitePragmaState = 'pending' | 'ok' | 'failed';
let sqlitePragmaState: SqlitePragmaState = 'pending';

let prismaSingleton: PrismaClient | undefined;

async function applySqlitePragmas(client: PrismaClient): Promise<void> {
  if (sqlitePragmaState !== 'pending') return;
  try {
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

/** Lazily construct Prisma so importing this module never touches DATABASE_URL at load time. */
export function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma ?? prismaSingleton;
  if (cached) {
    prismaSingleton = cached;
    return cached;
  }
  const client = createClient();
  prismaSingleton = client;
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }
  return client;
}

export async function ensureSqlitePragmas(): Promise<void> {
  await applySqlitePragmas(getPrisma());
}
