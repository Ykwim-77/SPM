const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const doctors = await prisma.user.findMany({ where: { role: 'medico', active: true }, select: { id: true, name: true, specialty: true, unit: true } });
  for (const doctor of doctors) {
    const locked = await prisma.doctorScheduleLock.findFirst({
      where: {
        doctorId: doctor.id,
        active: true,
        date: { gte: todayStart, lt: todayEnd },
      },
    });
    console.log(doctor.name, 'locked?', Boolean(locked), locked?.date?.toISOString?.());
  }
  const appts = await prisma.appointment.findMany({ where: { patientId: 'd5e44aa3-71ec-4abe-9de3-ce9aa63a97f0' }, orderBy: { createdAt: 'desc' } });
  console.log('appointments', JSON.stringify(appts, null, 2));
  await prisma.$disconnect();
})();
