const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const p = await prisma.patient.findFirst({ where: { email: "demo@saudepalma.com.br" } });
  console.log(JSON.stringify({
    id: p.id,
    birthDate: p.birthDate,
    address: p.address,
    motherName: p.motherName,
    fatherName: p.fatherName,
    susCard: p.susCard,
    cep: p.cep,
    cityState: p.cityState,
    nearestUnit: p.nearestUnit,
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
    substanceUse: p.substanceUse,
    allergies: p.allergies,
    chronicConditions: p.chronicConditions,
    lgpdAccepted: p.lgpdAccepted,
    blockedOnline: p.blockedOnline
  }, null, 2));
  await prisma.$disconnect();
})();
