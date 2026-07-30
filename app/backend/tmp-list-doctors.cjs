const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const users = await prisma.user.findMany({
    where: { role: 'medico' },
    select: { id: true, name: true, role: true, active: true, specialty: true, unit: true },
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})();
