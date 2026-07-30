const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const meds = await prisma.medication.findMany({ where: { patientId: '0d375193-09c8-4353-aa0a-23e980252756' }, orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(JSON.stringify(meds, null, 2));
  await prisma.$disconnect();
})();
