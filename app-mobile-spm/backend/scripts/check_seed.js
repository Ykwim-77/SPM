import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'demo@saudepalma.com.br' } });
  console.log('demo user exists:', !!user);
  if (!user) {
    return;
  }

  const [appointments, exams, medications, medLogs] = await Promise.all([
    prisma.appointment.count({ where: { userId: user.id } }),
    prisma.exam.count({ where: { userId: user.id } }),
    prisma.medication.count({ where: { userId: user.id } }),
    prisma.medicationLog.count({ where: { medication: { userId: user.id } } }),
  ]);

  console.log({ appointments, exams, medications, medLogs });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
