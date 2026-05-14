import '../env-bootstrap';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

let pragmasApplied = false;

async function applySqlitePragmas(client: PrismaClient): Promise<void> {
  if (pragmasApplied) return;
  await client.$executeRawUnsafe(`PRAGMA journal_mode=WAL;`);
  await client.$executeRawUnsafe(`PRAGMA busy_timeout=5000;`);
  pragmasApplied = true;
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
