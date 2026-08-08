const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const where = {
      OR: [
        { unit: 'spm Centro' },
        { doctor: { unit: 'spm Centro' } },
      ],
      status: { notIn: ['cancelado', 'cancelled', 'bloqueio_medico'] },
    };

    const appts = await prisma.appointment.findMany({
      where,
      include: { patient: true, doctor: true },
      orderBy: { scheduledAt: 'asc' },
    });
    console.log('filtered', appts.length);
    appts.forEach((a) => {
      console.log(a.id, a.unit, a.doctor?.unit, a.doctorId, a.doctor?.name, a.status);
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
