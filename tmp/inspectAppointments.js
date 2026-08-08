const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const appts = await prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        status: { notIn: ['cancelado', 'cancelled', 'bloqueio_medico'] },
      },
      include: { patient: true, doctor: true },
    });
    console.log('count', appts.length);
    appts.forEach((a) => {
      console.log(
        a.id,
        a.specialty,
        a.unit,
        a.status,
        a.doctorId,
        a.doctor?.name,
        a.doctor?.unit,
        a.patient?.name,
        a.scheduledAt.toISOString(),
      );
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
