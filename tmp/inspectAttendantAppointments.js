const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const attendants = await prisma.user.findMany({ where: { role: 'atendente' } });
    console.log('atendentes', attendants.length);
    attendants.forEach((u) => console.log(u.id, u.name, u.unit, u.email));

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

    console.log('today appts count', appts.length);
    appts.forEach((a) => {
      console.log('APPT', a.id, a.specialty, a.unit, a.status, a.doctorId, a.doctor?.name, a.doctor?.unit, a.patient?.name, a.scheduledAt.toISOString());
    });

    const units = [...new Set(appts.map((a) => a.unit))];
    console.log('appointment units', units);
    for (const unit of units) {
      const count = appts.filter((a) => a.unit === unit).length;
      console.log('unit', unit, 'count', count);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
