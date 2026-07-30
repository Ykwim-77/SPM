import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
(async () => {
  try {
    await prisma.$connect();
    const users = await prisma.user.findMany({ select: { id: true, email: true, pushToken: true } });
    console.log(JSON.stringify(users, null, 2));
  } catch (e) {
    console.error('Erro:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
