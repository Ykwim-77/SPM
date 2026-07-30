const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const users = await prisma.patient.findMany();
    console.log('Found', users.length, 'patients');
    if (users.length) {
      console.log('First patient keys:', Object.keys(users[0]));
    }
    for (const u of users) {
      await prisma.patient.update({ where: { id: u.id }, data: { accessibilityEnabled: true } });
      console.log('Updated', u.id);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
