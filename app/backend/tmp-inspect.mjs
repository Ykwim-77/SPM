import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const patient = await prisma.patient.findFirst({ where: { email: "demo@saudepalma.com.br" } });
console.log(JSON.stringify({
  name: patient?.name,
  address: patient?.address,
  motherName: patient?.motherName,
  emergencyContactName: patient?.emergencyContactName,
  substanceUse: patient?.substanceUse,
  allergies: patient?.allergies,
  chronicConditions: patient?.chronicConditions,
  email: patient?.email,
}, null, 2));
const appt = await prisma.appointment.findFirst({ where: { patientId: patient.id }, orderBy: { scheduledAt: "desc" } });
console.log(JSON.stringify({
  apptId: appt?.id,
  specialty: appt?.specialty,
  status: appt?.status,
  unit: appt?.unit,
}, null, 2));
await prisma.$disconnect();
