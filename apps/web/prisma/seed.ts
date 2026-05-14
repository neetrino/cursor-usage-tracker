import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const a1 = await prisma.cursorAccount.upsert({
    where: { owningUser: 'PLACEHOLDER_ULTRA_1' },
    update: {},
    create: {
      name: 'ultra_1',
      owningUser: 'PLACEHOLDER_ULTRA_1',
      description: 'Replace owningUser with real Cursor dashboard owningUser id',
    },
  });
  const a2 = await prisma.cursorAccount.upsert({
    where: { owningUser: 'PLACEHOLDER_ULTRA_2' },
    update: {},
    create: {
      name: 'ultra_2',
      owningUser: 'PLACEHOLDER_ULTRA_2',
      description: 'Replace owningUser with real Cursor dashboard owningUser id',
    },
  });

  await prisma.internalUser.upsert({
    where: { userKey: 'edgar' },
    update: {},
    create: {
      userKey: 'edgar',
      name: 'Edgar',
      computerId: 'pc-edgar',
      cursorAccountId: a1.id,
    },
  });
  await prisma.internalUser.upsert({
    where: { userKey: 'sipan' },
    update: {},
    create: {
      userKey: 'sipan',
      name: 'Sipan',
      computerId: 'pc-sipan',
      cursorAccountId: a1.id,
    },
  });
  await prisma.internalUser.upsert({
    where: { userKey: 'dev3' },
    update: {},
    create: {
      userKey: 'dev3',
      name: 'Dev Three',
      computerId: 'pc-dev3',
      cursorAccountId: a2.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
