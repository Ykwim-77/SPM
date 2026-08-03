import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const prisma = new PrismaClient();

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const withTime = (date, hours, minutes = 0) => {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const admin = await prisma.user.upsert({
    where: { email: "admin@saudeconecta.gov.br" },
    update: {
      name: "Admin SaúdeConecta",
      role: "admin",
    },
    create: {
      email: "admin@saudeconecta.gov.br",
      passwordHash: await bcrypt.hash("admin123", 10),
      name: "Admin SaúdeConecta",
      role: "admin",
    },
  });

  const attendant = await prisma.user.upsert({
    where: { email: "atendente@saudeconecta.gov.br" },
    update: {
      name: "Atendente SaúdeConecta",
      role: "atendente",
      unit: "UBS Centro",
    },
    create: {
      email: "atendente@saudeconecta.gov.br",
      passwordHash: await bcrypt.hash("senha123", 10),
      name: "Atendente SaúdeConecta",
      role: "atendente",
      unit: "UBS Centro",
    },
  });

  const doctor = await prisma.user.upsert({
    where: { email: "medico@saudeconecta.gov.br" },
    update: {
      name: "Dr. Fernando Souza",
      role: "medico",
      crm: "12345",
      specialty: "Clínica Geral",
      unit: "UBS Centro",
    },
    create: {
      email: "medico@saudeconecta.gov.br",
      passwordHash: await bcrypt.hash("senha123", 10),
      name: "Dr. Fernando Souza",
      role: "medico",
      crm: "12345",
      specialty: "Clínica Geral",
      unit: "UBS Centro",
    },
  });

  const doctor2 = await prisma.user.upsert({
    where: { email: "medico2@saudeconecta.gov.br" },
    update: {
      name: "Dra. Marina Pereira",
      role: "medico",
      crm: "67890",
      specialty: "Cardiologia",
      unit: "UBS Centro",
    },
    create: {
      email: "medico2@saudeconecta.gov.br",
      passwordHash: await bcrypt.hash("senha123", 10),
      name: "Dra. Marina Pereira",
      role: "medico",
      crm: "67890",
      specialty: "Cardiologia",
      unit: "UBS Centro",
    },
  });

  const demoPatient = await prisma.patient.upsert({
    where: { cpf: "000.000.000-00" },
    update: {
      name: "Paciente Demo",
      email: "demo@saudepalma.com.br",
      phone: "(11) 99999-9999",
      birthDate: new Date("1988-05-15T00:00:00.000Z"),
      address: "Rua Saúde, 123, Palmeira",
      sex: "Não informado",
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
      updatedAt: new Date(),
    },
    create: {
      name: "Paciente Demo",
      cpf: "000.000.000-00",
      email: "demo@saudepalma.com.br",
      phone: "(11) 99999-9999",
      birthDate: new Date("1988-05-15T00:00:00.000Z"),
      address: "Rua Saúde, 123, Palmeira",
      sex: "Não informado",
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

  await prisma.userAuth.upsert({
    where: { email: "demo@saudepalma.com.br" },
    update: {
      passwordHash: await bcrypt.hash("senha123", 10),
      role: "patient",
      patientId: demoPatient.id,
      mustChangePassword: false,
      updatedAt: new Date(),
    },
    create: {
      email: "demo@saudepalma.com.br",
      passwordHash: await bcrypt.hash("senha123", 10),
      role: "patient",
      patientId: demoPatient.id,
      mustChangePassword: false,
    },
  });

  await prisma.consentRecord.upsert({
    where: { patientId_purpose: { patientId: demoPatient.id, purpose: "doctor_history_view" } },
    update: { granted: true, updatedAt: new Date() },
    create: { patientId: demoPatient.id, purpose: "doctor_history_view", granted: true },
  });

  const appointments = [
    {
      id: "appt-demo-1",
      specialty: "Clínica Geral",
      doctorId: doctor.id,
      scheduledAt: withTime(addDays(today, 1), 10, 0),
      unit: "UBS Centro",
      status: "aguardando",
      priority: "normal",
      type: "presencial",
    },
    {
      id: "appt-demo-2",
      specialty: "Cardiologia",
      doctorId: doctor2.id,
      scheduledAt: withTime(addDays(today, 2), 14, 30),
      unit: "UBS Centro",
      status: "confirmado",
      priority: "normal",
      type: "presencial",
    },
    {
      id: "appt-demo-3",
      specialty: "Clínica Geral",
      doctorId: doctor.id,
      scheduledAt: withTime(addDays(today, 3), 9, 30),
      unit: "UBS Centro",
      status: "aguardando",
      priority: "normal",
      type: "online",
    },
    {
      id: "appt-demo-4",
      specialty: "Clínica Geral",
      doctorId: doctor.id,
      scheduledAt: withTime(addDays(today, -1), 11, 0),
      unit: "UBS Centro",
      status: "compareceu",
      priority: "normal",
      type: "presencial",
    },
  ];

  for (const record of appointments) {
    await prisma.appointment.upsert({
      where: { id: record.id },
      update: {
        doctorId: record.doctorId,
        specialty: record.specialty,
        scheduledAt: record.scheduledAt,
        unit: record.unit,
        status: record.status,
        priority: record.priority,
        type: record.type,
      },
      create: {
        id: record.id,
        patientId: demoPatient.id,
        doctorId: record.doctorId,
        specialty: record.specialty,
        scheduledAt: record.scheduledAt,
        unit: record.unit,
        status: record.status,
        priority: record.priority,
        type: record.type,
      },
    });
  }

  await prisma.exam.upsert({
    where: { id: "exam-demo-1" },
    update: {
      patientId: demoPatient.id,
      exam: "Hemograma",
      status: "laudo_pronto",
      urgent: false,
      requestedById: doctor.id,
      readyAt: addDays(today, -3),
      deliveredAt: addDays(today, -2),
      updatedAt: new Date(),
    },
    create: {
      id: "exam-demo-1",
      patientId: demoPatient.id,
      exam: "Hemograma",
      status: "laudo_pronto",
      urgent: false,
      requestedById: doctor.id,
      readyAt: addDays(today, -3),
      deliveredAt: addDays(today, -2),
    },
  });

  await prisma.exam.upsert({
    where: { id: "exam-demo-2" },
    update: {
      patientId: demoPatient.id,
      exam: "Raio-X de Tórax",
      status: "pendente",
      urgent: false,
      requestedById: doctor.id,
      readyAt: null,
      deliveredAt: null,
      updatedAt: new Date(),
    },
    create: {
      id: "exam-demo-2",
      patientId: demoPatient.id,
      exam: "Raio-X de Tórax",
      status: "pendente",
      urgent: false,
      requestedById: doctor.id,
    },
  });

  const prescription = await prisma.prescription.upsert({
    where: { id: "presc-demo-1" },
    update: {
      patientId: demoPatient.id,
      doctorId: doctor.id,
      doctorName: doctor.name,
      medication: "Losartana",
      activeSubstance: "Losartana",
      dosage: "50mg",
      frequency: "1x ao dia",
      durationDays: 30,
      route: "Oral",
      schedule: JSON.stringify(["08:00"]),
      validationCode: "VAL12345",
      active: true,
      updatedAt: new Date(),
    },
    create: {
      id: "presc-demo-1",
      patientId: demoPatient.id,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorCrm: doctor.crm,
      medication: "Losartana",
      activeSubstance: "Losartana",
      dosage: "50mg",
      frequency: "1x ao dia",
      durationDays: 30,
      route: "Oral",
      schedule: JSON.stringify(["08:00"]),
      validationCode: "VAL12345",
      active: true,
    },
  });

  const medication = await prisma.medication.upsert({
    where: { id: "med-demo-1" },
    update: {
      patientId: demoPatient.id,
      prescriptionId: prescription.id,
      name: "Losartana",
      dosage: "50mg",
      frequency: "1x ao dia",
      schedules: "08:00",
      startDate: today,
      endDate: addDays(today, 30),
      initialQuantity: 30,
      remainingQuantity: 20,
      updatedAt: new Date(),
    },
    create: {
      id: "med-demo-1",
      patientId: demoPatient.id,
      prescriptionId: prescription.id,
      name: "Losartana",
      dosage: "50mg",
      frequency: "1x ao dia",
      schedules: "08:00",
      startDate: today,
      endDate: addDays(today, 30),
      initialQuantity: 30,
      remainingQuantity: 20,
    },
  });

  await prisma.medication.upsert({
    where: { id: "med-demo-2" },
    update: {
      patientId: demoPatient.id,
      name: "Metformina",
      dosage: "500mg",
      frequency: "2x ao dia",
      schedules: "08:00,21:00",
      startDate: today,
      endDate: addDays(today, 30),
      initialQuantity: 60,
      remainingQuantity: 35,
      updatedAt: new Date(),
    },
    create: {
      id: "med-demo-2",
      patientId: demoPatient.id,
      name: "Metformina",
      dosage: "500mg",
      frequency: "2x ao dia",
      schedules: "08:00,21:00",
      startDate: today,
      endDate: addDays(today, 30),
      initialQuantity: 60,
      remainingQuantity: 35,
    },
  });

  await prisma.medicationLog.upsert({
    where: { id: "medlog-demo-1" },
    update: {
      patientId: demoPatient.id,
      medicationId: medication.id,
      confirmedAt: addDays(today, -1),
      source: "user_mobile",
    },
    create: {
      id: "medlog-demo-1",
      patientId: demoPatient.id,
      medicationId: medication.id,
      confirmedAt: addDays(today, -1),
      source: "user_mobile",
    },
  });

  await prisma.onlineSlotConfig.upsert({
    where: { unit_dayOfWeek: { unit: "UBS Centro", dayOfWeek: today.getDay() } },
    update: {
      onlinePercentage: 50,
      maxOnlineSlots: 4,
      updatedAt: new Date(),
    },
    create: {
      unit: "UBS Centro",
      dayOfWeek: today.getDay(),
      onlinePercentage: 50,
      maxOnlineSlots: 4,
    },
  });

  await prisma.appointmentConfig.upsert({
    where: { id: "config-demo-1" },
    update: {
      specialty: "Clínica Geral",
      dayOfWeek: today.getDay(),
      maxOnlineSlots: 4,
      maxTotalSlots: 18,
      active: true,
      updatedAt: new Date(),
      createdById: admin.id,
    },
    create: {
      id: "config-demo-1",
      specialty: "Clínica Geral",
      dayOfWeek: today.getDay(),
      maxOnlineSlots: 4,
      maxTotalSlots: 18,
      active: true,
      createdById: admin.id,
    },
  });

  await prisma.doctorScheduleLock.upsert({
    where: { id: "lock-demo-1" },
    update: {
      date: addDays(today, 5),
      reason: "Folga programada",
      active: true,
      doctor: { connect: { id: doctor.id } },
      lockedBy: { connect: { id: attendant.id } },
    },
    create: {
      id: "lock-demo-1",
      date: addDays(today, 5),
      reason: "Folga programada",
      active: true,
      doctor: { connect: { id: doctor.id } },
      lockedBy: { connect: { id: attendant.id } },
    },
  });

  await prisma.waitingList.upsert({
    where: { id: "waiting-demo-1" },
    update: {
      specialty: "Ginecologia",
      status: "waiting",
      patient: { connect: { id: demoPatient.id } },
    },
    create: {
      id: "waiting-demo-1",
      specialty: "Ginecologia",
      status: "waiting",
      patient: { connect: { id: demoPatient.id } },
    },
  });

  await prisma.vacancy.upsert({
    where: { id: "vacancy-demo-1" },
    update: {
      patientName: demoPatient.name,
      specialty: "Clínica Geral",
      unit: "UBS Centro",
      notifiedAt: addDays(today, -1),
      deadline: addDays(today, 2),
      status: "waiting_response",
      patient: { connect: { id: demoPatient.id } },
    },
    create: {
      id: "vacancy-demo-1",
      patientName: demoPatient.name,
      specialty: "Clínica Geral",
      unit: "UBS Centro",
      notifiedAt: addDays(today, -1),
      deadline: addDays(today, 2),
      patient: { connect: { id: demoPatient.id } },
    },
  });

  console.log("Database seed applied successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
