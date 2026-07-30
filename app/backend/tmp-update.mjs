import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const p = await prisma.patient.findFirst({ where: { email: "demo@saudepalma.com.br" } });
if (p) {
  await prisma.patient.update({
    where: { id: p.id },
    data: {
      birthDate: new Date("1988-05-15T00:00:00.000Z"),
      address: "Rua Saúde, 123, Palmeira",
      motherName: "Maria Demo",
      fatherName: "José Demo",
      susCard: "000000000000000",
      cep: "01000-000",
      cityState: "São Paulo / SP",
      nearestUnit: "UBS Centro",
      emergencyContactName: "Contato Demo",
      emergencyContactPhone: "(11) 98888-7777",
      substanceUse: "Não informado",
      allergies: "Nenhuma",
      chronicConditions: "Hipertensão",
      lgpdAccepted: true,
      blockedOnline: false,
    },
  });
  await prisma.consentRecord.upsert({
    where: { patientId_purpose: { patientId: p.id, purpose: "doctor_history_view" } },
    update: { granted: true },
    create: { patientId: p.id, purpose: "doctor_history_view", granted: true },
  });
}
await prisma.$disconnect();
