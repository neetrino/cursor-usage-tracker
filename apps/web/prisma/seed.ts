import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const mainAccount = await prisma.cursorAccount.upsert({
    where: { owningUser: '289049274' },
    update: { name: 'ultra_1', description: null },
    create: {
      name: 'ultra_1',
      owningUser: '289049274',
    },
  });

  const secondAccount = await prisma.cursorAccount.upsert({
    where: { owningUser: 'PLACEHOLDER_ULTRA_2' },
    update: {},
    create: {
      name: 'ultra_2',
      owningUser: 'PLACEHOLDER_ULTRA_2',
      description: 'Replace with real second Cursor dashboard owningUser id',
    },
  });

  await prisma.internalUser.upsert({
    where: { userKey: 'edgar' },
    update: {
      name: 'Edgar',
      computerId: 'pc-edgar',
      cursorAccountId: mainAccount.id,
    },
    create: {
      userKey: 'edgar',
      name: 'Edgar',
      computerId: 'pc-edgar',
      cursorAccountId: mainAccount.id,
    },
  });
  await prisma.internalUser.upsert({
    where: { userKey: 'sipan' },
    update: {
      name: 'Sipan',
      computerId: 'pc-sipan',
      cursorAccountId: mainAccount.id,
    },
    create: {
      userKey: 'sipan',
      name: 'Sipan',
      computerId: 'pc-sipan',
      cursorAccountId: mainAccount.id,
    },
  });
  await prisma.internalUser.upsert({
    where: { userKey: 'dev3' },
    update: {
      name: 'Dev Three',
      computerId: 'pc-dev3',
      cursorAccountId: secondAccount.id,
    },
    create: {
      userKey: 'dev3',
      name: 'Dev Three',
      computerId: 'pc-dev3',
      cursorAccountId: secondAccount.id,
    },
  });

  await prisma.cursorAccount.deleteMany({
    where: { owningUser: 'PLACEHOLDER_ULTRA_1' },
  });

  console.log(
    `Seed OK: CursorAccount "${mainAccount.name}" owningUser=289049274; InternalUser edgar → that account.`,
  );
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
