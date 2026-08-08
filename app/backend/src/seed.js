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

  // --- Additional demo data for dashboard / secretary metrics ---
  // Create health units
  const units = [
    { id: 'unit-ubs-centro', name: 'UBS Centro' },
    { id: 'unit-ubs-norte', name: 'UBS Norte' },
    { id: 'unit-policlinica-sul', name: 'Policlínica Sul' },
  ];

  for (const u of units) {
    await prisma.healthUnit.upsert({
      where: { id: u.id },
      update: { name: u.name },
      create: { id: u.id, name: u.name },
    });
  }

  // Create medicine master list via stock transactions and stocks
  const medicines = [
    { id: 'med-losartana', name: 'Losartana' },
    { id: 'med-metformina', name: 'Metformina' },
    { id: 'med-omeprazol', name: 'Omeprazol' },
  ];

  // Seed stocks and initial transactions
  for (const u of units) {
    for (const m of medicines) {
      const stockId = `${u.id}-${m.id}`;
      await prisma.medicineStock.upsert({
        where: { id: stockId },
        update: { quantity: 200 },
        create: { id: stockId, healthUnitId: u.id, medicineId: m.id, quantity: 200 },
      });

      const detailsObj = { note: 'Recebimento inicial para demonstração', source: 'seed' };
      await prisma.stockTransaction.upsert({
        where: { id: `${stockId}-tx-initial` },
        update: {
          healthUnitId: u.id,
          medicineId: m.id,
          medicineName: m.name,
          medicineDetails: JSON.stringify(detailsObj),
          userId: attendant.id,
          type: 'ENTRY',
          quantity: 200,
          createdAt: addDays(today, -30),
        },
        create: {
          id: `${stockId}-tx-initial`,
          healthUnitId: u.id,
          medicineId: m.id,
          medicineName: m.name,
          medicineDetails: JSON.stringify(detailsObj),
          userId: attendant.id,
          type: 'ENTRY',
          quantity: 200,
          createdAt: addDays(today, -30),
        },
      });
    }
  }

  // Create a small cohort of demo patients to populate dashboard stats
  const extraPatients = [];
  for (let i = 1; i <= 10; i++) {
    const cpf = `100.000.00${String(i).padStart(2, '0')}-0${i}`;
    const email = `paciente${i}@saudepalma.com.br`;
    const p = await prisma.patient.upsert({
      where: { cpf },
      update: {
        name: `Paciente Demo ${i}`,
        email,
        phone: `(46) 9${90000000 + i}`,
        birthDate: addDays(today, -10000 - i),
        nearestUnit: units[i % units.length].name,
        chronicConditions: i % 2 === 0 ? 'Diabetes' : 'Hipertensão',
        allergies: i % 3 === 0 ? 'Aspirina' : 'Nenhuma',
        updatedAt: new Date(),
      },
      create: {
        cpf,
        name: `Paciente Demo ${i}`,
        email,
        phone: `(46) 9${90000000 + i}`,
        birthDate: addDays(today, -10000 - i),
        nearestUnit: units[i % units.length].name,
        chronicConditions: i % 2 === 0 ? 'Diabetes' : 'Hipertensão',
        allergies: i % 3 === 0 ? 'Aspirina' : 'Nenhuma',
        lgpdAccepted: true,
      },
    });
    extraPatients.push(p);

    // create userAuth for some patients for dashboard counts
    await prisma.userAuth.upsert({
      where: { email },
      update: { passwordHash: await bcrypt.hash('senha123', 10), role: 'patient', patientId: p.id, updatedAt: new Date() },
      create: { email, passwordHash: await bcrypt.hash('senha123', 10), role: 'patient', patientId: p.id },
    });
  }

  // Create appointments for these patients spread across units and statuses
  const statuses = ['aguardando', 'confirmado', 'compareceu', 'faltou'];
  for (let i = 0; i < extraPatients.length; i++) {
    const pat = extraPatients[i];
    const doctorAssigned = i % 2 === 0 ? doctor : doctor2;
    const scheduled = withTime(addDays(today, (i % 7) - 3), 8 + (i % 8), i % 2 ? 30 : 0);
    const status = statuses[i % statuses.length];

    await prisma.appointment.upsert({
      where: { id: `appt-extra-${i + 1}` },
      update: {
        patientId: pat.id,
        doctorId: doctorAssigned.id,
        specialty: doctorAssigned.specialty || 'Clínica Geral',
        scheduledAt: scheduled,
        unit: pat.nearestUnit || 'UBS Centro',
        status,
        priority: i % 5 === 0 ? 'alta' : 'normal',
        type: i % 4 === 0 ? 'online' : 'presencial',
      },
      create: {
        id: `appt-extra-${i + 1}`,
        patientId: pat.id,
        doctorId: doctorAssigned.id,
        specialty: doctorAssigned.specialty || 'Clínica Geral',
        scheduledAt: scheduled,
        unit: pat.nearestUnit || 'UBS Centro',
        status,
        priority: i % 5 === 0 ? 'alta' : 'normal',
        type: i % 4 === 0 ? 'online' : 'presencial',
      },
    });

    // increment missedCount for 'falta' patients
    if (status === 'falta') {
      await prisma.patient.update({ where: { id: pat.id }, data: { missedCount: { increment: 1 } } }).catch(() => {});
    }
  }

  // Create more prescriptions / medications for dashboard medication pipeline
  for (let i = 0; i < extraPatients.length; i++) {
    const pat = extraPatients[i];
    const medName = i % 3 === 0 ? 'Losartana' : i % 3 === 1 ? 'Metformina' : 'Omeprazol';
    const prescId = `presc-extra-${i + 1}`;
    const presc = await prisma.prescription.upsert({
      where: { id: prescId },
      update: {
        patientId: pat.id,
        doctorId: doctor.id,
        doctorName: doctor.name,
        medication: medName,
        activeSubstance: medName,
        dosage: medName === 'Metformina' ? '500mg' : '50mg',
        frequency: medName === 'Metformina' ? '2x ao dia' : '1x ao dia',
        schedule: JSON.stringify(["08:00"]),
        durationDays: 30,
        validationCode: `VAL-${i + 1000}`,
        updatedAt: new Date(),
      },
      create: {
        id: prescId,
        patientId: pat.id,
        doctorId: doctor.id,
        doctorName: doctor.name,
        medication: medName,
        activeSubstance: medName,
        dosage: medName === 'Metformina' ? '500mg' : '50mg',
        frequency: medName === 'Metformina' ? '2x ao dia' : '1x ao dia',
        schedule: JSON.stringify(["08:00"]),
        durationDays: 30,
        validationCode: `VAL-${i + 1000}`,
        active: true,
      },
    });

    await prisma.medication.upsert({
      where: { id: `med-extra-${i + 1}` },
      update: {
        patientId: pat.id,
        prescriptionId: presc.id,
        name: medName,
        dosage: presc.dosage,
        frequency: presc.frequency,
        startDate: today,
        endDate: addDays(today, 30),
        initialQuantity: 30,
        remainingQuantity: 25 - (i % 5),
        updatedAt: new Date(),
      },
      create: {
        id: `med-extra-${i + 1}`,
        patientId: pat.id,
        prescriptionId: presc.id,
        name: medName,
        dosage: presc.dosage,
        frequency: presc.frequency,
        startDate: today,
        endDate: addDays(today, 30),
        initialQuantity: 30,
        remainingQuantity: 25 - (i % 5),
      },
    });
  }

  // Add some adherence alerts and medication logs for analytics
  for (let i = 0; i < Math.min(8, extraPatients.length); i++) {
    const pat = extraPatients[i];
    await prisma.adherenceAlert.upsert({
      where: { id: `adherence-${i + 1}` },
      update: {
        patientId: pat.id,
        prescriptionId: null,
        pattern: i % 2 === 0 ? 'missed_doses' : 'late_doses',
        createdAt: new Date(),
      },
      create: {
        id: `adherence-${i + 1}`,
        patientId: pat.id,
        prescriptionId: null,
        pattern: i % 2 === 0 ? 'missed_doses' : 'late_doses',
      },
    });

    await prisma.medicationLog.upsert({
      where: { id: `medlog-extra-${i + 1}` },
      update: {
        patientId: pat.id,
        medicationId: `med-extra-${i + 1}`,
        confirmedAt: addDays(today, -(i % 4)),
        source: i % 2 === 0 ? 'user_mobile' : 'attendant_kiosk',
      },
      create: {
        id: `medlog-extra-${i + 1}`,
        patientId: pat.id,
        medicationId: `med-extra-${i + 1}`,
        confirmedAt: addDays(today, -(i % 4)),
        source: i % 2 === 0 ? 'user_mobile' : 'attendant_kiosk',
      },
    });
  }

  // Create a few audit logs to show recent activity on dashboard
  const actions = ['create_appointment', 'cancel_appointment', 'confirm_medication', 'stock_adjustment'];
  for (let i = 0; i < 12; i++) {
    await prisma.auditLog.upsert({
      where: { id: `audit-${i + 1}` },
      update: {
        userId: i % 3 === 0 ? admin.id : attendant.id,
        userName: i % 3 === 0 ? admin.name : attendant.name,
        userRole: i % 3 === 0 ? admin.role : attendant.role,
        action: actions[i % actions.length],
        target: `target-${i + 1}`,
        details: JSON.stringify({ note: 'Ação de demonstração para dashboard' }),
        timestamp: addDays(today, -i),
      },
      create: {
        id: `audit-${i + 1}`,
        userId: i % 3 === 0 ? admin.id : attendant.id,
        userName: i % 3 === 0 ? admin.name : attendant.name,
        userRole: i % 3 === 0 ? admin.role : attendant.role,
        action: actions[i % actions.length],
        target: `target-${i + 1}`,
        details: JSON.stringify({ note: 'Ação de demonstração para dashboard' }),
        timestamp: addDays(today, -i),
      },
    });
  }

  // --- Generate historical data for last 30 days to feed dashboard ---
  const startDate = addDays(today, -30);
  const specialties = ['Clínica Geral', 'Cardiologia', 'Ginecologia', 'Pediatria', 'Psiquiatria'];
  const unitsNames = units.map((u) => u.name);

  // Create additional patients and appointments across the last 30 days
  for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
    const date = withTime(addDays(startDate, dayOffset), 8, 0);
    // create between 5 and 12 appointments per day
    const apptsCount = 5 + Math.floor(Math.random() * 8);
    for (let j = 0; j < apptsCount; j++) {
      const patient = extraPatients[(dayOffset + j) % extraPatients.length];
      const doc = (j % 2 === 0) ? doctor : doctor2;
      const specialty = specialties[(dayOffset + j) % specialties.length];
      const scheduled = withTime(addDays(startDate, dayOffset), 8 + (j % 9), (j % 2) ? 30 : 0);
      const statusRoll = Math.random();
      const status = statusRoll < 0.75 ? 'compareceu' : statusRoll < 0.9 ? 'confirmado' : 'faltou';

      await prisma.appointment.create({
        data: {
          id: `hist-appt-${dayOffset}-${j}`,
          patientId: patient.id,
          doctorId: doc.id,
          specialty,
          scheduledAt: scheduled,
          unit: unitsNames[(dayOffset + j) % unitsNames.length],
          status,
          priority: Math.random() < 0.1 ? 'alta' : 'normal',
          type: Math.random() < 0.2 ? 'online' : 'presencial',
        },
      }).catch(() => {});

      if (status === 'faltou') {
        await prisma.patient.update({ where: { id: patient.id }, data: { missedCount: { increment: 1 } } }).catch(() => {});
      }
    }
  }

  // Create some historical prescriptions and exams
  for (let i = 0; i < extraPatients.length; i++) {
    const pat = extraPatients[i];
    for (let k = 0; k < 3; k++) {
      const createdAt = addDays(startDate, Math.floor(Math.random() * 30));
      const med = ['Losartana', 'Metformina', 'Omeprazol'][k % 3];
      const prescId = `hist-presc-${i}-${k}`;
      await prisma.prescription.upsert({
        where: { id: prescId },
        update: {
          patientId: pat.id,
          doctorId: doctor.id,
          doctorName: doctor.name,
          medication: med,
          activeSubstance: med,
          dosage: med === 'Metformina' ? '500mg' : '50mg',
          frequency: med === 'Metformina' ? '2x ao dia' : '1x ao dia',
          schedule: JSON.stringify(['08:00']),
          durationDays: 30,
          validationCode: `HVAL-${i}-${k}`,
          updatedAt: new Date(),
        },
        create: {
          id: prescId,
          patientId: pat.id,
          doctorId: doctor.id,
          doctorName: doctor.name,
          medication: med,
          activeSubstance: med,
          dosage: med === 'Metformina' ? '500mg' : '50mg',
          frequency: med === 'Metformina' ? '2x ao dia' : '1x ao dia',
          schedule: JSON.stringify(['08:00']),
          durationDays: 30,
          validationCode: `HVAL-${i}-${k}`,
          active: Math.random() < 0.6,
          createdAt,
        },
      });
    }

    // random exams
    for (let e = 0; e < 2; e++) {
      const exId = `hist-exam-${i}-${e}`;
      const createdAt = addDays(startDate, Math.floor(Math.random() * 30));
      await prisma.exam.upsert({
        where: { id: exId },
        update: {
          patientId: pat.id,
          exam: e % 2 === 0 ? 'Hemograma' : 'Raio-X de Tórax',
          status: Math.random() < 0.6 ? 'pendente' : 'laudo_pronto',
          requestedById: doctor.id,
          updatedAt: new Date(),
        },
        create: {
          id: exId,
          patientId: pat.id,
          exam: e % 2 === 0 ? 'Hemograma' : 'Raio-X de Tórax',
          status: Math.random() < 0.6 ? 'pendente' : 'laudo_pronto',
          requestedById: doctor.id,
          createdAt,
        },
      });
    }
  }

  // Add historical stock exits/entries to show movement trends
  for (let d = 0; d < 30; d++) {
    const day = addDays(startDate, d);
    const entries = 1 + Math.floor(Math.random() * 3);
    for (let en = 0; en < entries; en++) {
      const unit = units[(d + en) % units.length];
      const med = medicines[(d + en) % medicines.length];
      await prisma.stockTransaction.create({
        data: {
          id: `hist-stx-${d}-${en}`,
          healthUnitId: unit.id,
          medicineId: med.id,
          medicineName: med.name,
          medicineDetails: JSON.stringify({ note: 'Histórico entry', source: 'seed' }),
          userId: attendant.id,
          type: 'ENTRY',
          quantity: 20 + Math.floor(Math.random() * 40),
          createdAt: withTime(day, 9 + en, 0),
        },
      }).catch(() => {});
    }
    const exits = Math.floor(Math.random() * 4);
    for (let ex = 0; ex < exits; ex++) {
      const unit = units[(d + ex) % units.length];
      const med = medicines[(d + ex) % medicines.length];
      await prisma.stockTransaction.create({
        data: {
          id: `hist-stx-ex-${d}-${ex}`,
          healthUnitId: unit.id,
          medicineId: med.id,
          medicineName: med.name,
          medicineDetails: JSON.stringify({ note: 'Histórico exit', source: 'seed' }),
          userId: attendant.id,
          type: 'EXIT',
          quantity: 5 + Math.floor(Math.random() * 15),
          createdAt: withTime(day, 12 + ex, 0),
        },
      }).catch(() => {});
    }
  }

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
