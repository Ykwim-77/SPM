import crypto from "crypto";
import express from "express";
import { prisma } from "./auth.js";

const router = express.Router();

const success = (res, data, status = 200) =>
  res.status(status).json({ success: true, data, error: null });
const failure = (res, code, message, status = 400) =>
  res.status(status).json({ success: false, data: null, error: { code, message } });

/**
 * These routes are only for the mobile backend. They deliberately do not accept
 * a patient JWT: the web backend has a distinct staff token audience. The
 * mobile backend authenticates the patient first and forwards only the patient
 * id plus this service credential.
 */
function requireInternalService(req, res, next) {
  const configuredSecret = process.env.INTERNAL_SERVICE_SECRET;
  const receivedSecret = req.get("x-internal-service-secret") || "";

  if (!configuredSecret) {
    return failure(
      res,
      "INTERNAL_SERVICE_NOT_CONFIGURED",
      "A integração interna de agenda não está configurada.",
      503,
    );
  }

  const expected = Buffer.from(configuredSecret);
  const received = Buffer.from(receivedSecret);
  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return failure(res, "UNAUTHORIZED", "Serviço interno não autorizado.", 401);
  }
  next();
}

const cancelledStatuses = ["cancelado", "cancelled", "bloqueio_medico"];
const VACANCY_RESPONSE_WINDOW_MS = 1000 * 60 * 15;

const localDayRange = (date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

async function createVacancyForNextPatient(tx, specialty, unit) {
  const activeVacancy = await tx.vacancy.findFirst({
    where: {
      specialty,
      unit,
      status: "waiting_response",
      deadline: { gt: new Date() },
    },
  });
  if (activeVacancy) return null;

  const nextWaiting = await tx.waitingList.findFirst({
    where: { specialty, status: "waiting" },
    orderBy: { createdAt: "asc" },
    include: { patient: true },
  });
  if (!nextWaiting) return null;

  await tx.waitingList.update({
    where: { id: nextWaiting.id },
    data: { status: "notified" },
  });

  return tx.vacancy.create({
    data: {
      patientId: nextWaiting.patientId,
      patientName: nextWaiting.patient.name,
      specialty,
      unit,
      notifiedAt: new Date(),
      deadline: new Date(Date.now() + VACANCY_RESPONSE_WINDOW_MS),
      status: "waiting_response",
    },
  });
}

async function expireAndCascadeVacancy(tx, vacancy) {
  await tx.vacancy.update({ where: { id: vacancy.id }, data: { status: "expired" } });
  return createVacancyForNextPatient(tx, vacancy.specialty, vacancy.unit);
}

async function selectDoctor(tx, { doctorId, specialty, unit, scheduledAt }) {
  if (doctorId) {
    const doctor = await tx.user.findFirst({
      where: { id: doctorId, role: "medico", active: true },
    });
    if (doctor) return doctor;
  }

  const requestedSpecialty = specialty?.trim();
  const doctors = await tx.user.findMany({
    where: {
      role: "medico",
      active: true,
      ...(requestedSpecialty && requestedSpecialty !== "UPA" && requestedSpecialty !== "Clínica Geral"
        ? { specialty: requestedSpecialty }
        : {}),
      ...(unit ? { unit } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  for (const doctor of doctors) {
    const locked = await tx.doctorScheduleLock.findFirst({
      where: {
        doctorId: doctor.id,
        active: true,
        date: { gte: localDayRange(scheduledAt).start, lt: localDayRange(scheduledAt).end },
      },
    });
    if (!locked) return doctor;
  }

  if (requestedSpecialty === "UPA" || requestedSpecialty === "Clínica Geral") {
    const fallback = await tx.user.findFirst({
      where: {
        role: "medico",
        active: true,
      },
      orderBy: { createdAt: "asc" },
    });
    if (fallback) {
      const locked = await tx.doctorScheduleLock.findFirst({
        where: {
          doctorId: fallback.id,
          active: true,
          date: { gte: localDayRange(scheduledAt).start, lt: localDayRange(scheduledAt).end },
        },
      });
      if (!locked) return fallback;
    }
  }

  return null;
}

async function assertOnlineCapacity(tx, unit, scheduledAt) {
  const { start, end } = localDayRange(scheduledAt);
  const config = await tx.onlineSlotConfig.findUnique({
    where: { unit_dayOfWeek: { unit, dayOfWeek: scheduledAt.getDay() } },
  });
  if (!config || config.maxOnlineSlots <= 0) return;
  const used = await tx.appointment.count({
    where: {
      unit,
      type: "online",
      scheduledAt: { gte: start, lt: end },
      status: { notIn: cancelledStatuses },
    },
  });
  if (used >= config.maxOnlineSlots) {
    const error = new Error("SLOT_TAKEN");
    error.code = "SLOT_TAKEN";
    throw error;
  }
}

async function createOrRescheduleAppointment(payload) {
  const scheduledAt = new Date(payload.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    const error = new Error("VALIDATION_ERROR");
    error.code = "VALIDATION_ERROR";
    error.message = "Informe um horário futuro válido.";
    throw error;
  }

  return prisma.$transaction(
    async (tx) => {
      console.log("[integration] booking request", { patientId: payload.patientId, specialty: payload.specialty, unit: payload.unit, scheduledAt: payload.scheduledAt, doctorId: payload.doctorId });
      const patient = await tx.patient.findUnique({ where: { id: payload.patientId } });
      if (!patient) {
        const error = new Error("NOT_FOUND");
        error.code = "NOT_FOUND";
        error.message = "Paciente não encontrado.";
        throw error;
      }
      if (patient.blockedOnline) {
        const error = new Error("PATIENT_BLOCKED");
        error.code = "PATIENT_BLOCKED";
        error.message = "Agendamento online bloqueado para este paciente.";
        throw error;
      }

      const requestedUnit = payload.unit || "UBS Central";
      const specialty = payload.specialty || "Clínica Geral";
      const doctor = await selectDoctor(tx, { ...payload, specialty, unit: requestedUnit, scheduledAt });
      console.log("[integration] selected doctor", doctor?.id, doctor?.name, doctor?.specialty);
      if (!doctor) {
        const error = new Error("NOT_FOUND");
        error.code = "NOT_FOUND";
        error.message = "Não há profissional disponível para este horário.";
        throw error;
      }

      const unit = doctor.unit || requestedUnit;
      await assertOnlineCapacity(tx, unit, scheduledAt);
      const taken = await tx.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          scheduledAt,
          status: { notIn: cancelledStatuses },
          ...(payload.appointmentId ? { id: { not: payload.appointmentId } } : {}),
        },
      });
      if (taken) {
        const error = new Error("SLOT_TAKEN");
        error.code = "SLOT_TAKEN";
        error.message = "Horário já ocupado.";
        throw error;
      }

      const data = {
        doctorId: doctor.id,
        specialty,
        unit,
        scheduledAt,
        priority: payload.priority || "normal",
        type: "presencial",
        status: "aguardando",
        justification: payload.justification || null,
      };
      if (payload.appointmentId) {
        const owned = await tx.appointment.findFirst({
          where: { id: payload.appointmentId, patientId: patient.id },
        });
        if (!owned) {
          const error = new Error("NOT_FOUND");
          error.code = "NOT_FOUND";
          error.message = "Consulta não encontrada.";
          throw error;
        }
        if (cancelledStatuses.includes(owned.status)) {
          const error = new Error("VALIDATION_ERROR");
          error.code = "VALIDATION_ERROR";
          error.message = "Não é possível reagendar uma consulta cancelada.";
          throw error;
        }
        return tx.appointment.update({ where: { id: owned.id }, data });
      }
      return tx.appointment.create({ data: { ...data, patientId: patient.id } });
    },
    { maxWait: 5000, timeout: 10000 },
  );
}

router.use(requireInternalService);

router.post("/appointments/book", async (req, res) => {
  try {
    const appointment = await createOrRescheduleAppointment(req.body || {});
    return success(res, appointment, 201);
  } catch (error) {
    if (error.code === "SLOT_TAKEN")
      return failure(res, "SLOT_TAKEN", error.message || "Horário já ocupado.", 409);
    if (error.code === "PATIENT_BLOCKED")
      return failure(res, "PATIENT_BLOCKED", error.message, 403);
    if (error.code === "NOT_FOUND") return failure(res, "NOT_FOUND", error.message, 404);
    if (error.code === "VALIDATION_ERROR")
      return failure(res, "VALIDATION_ERROR", error.message, 422);
    if (String(error?.message).includes("SQLITE_BUSY"))
      return failure(res, "SLOT_TAKEN", "Agenda ocupada. Tente novamente.", 409);
    throw error;
  }
});

router.post("/appointments/cancel", async (req, res) => {
  const { appointmentId, patientId, reason } = req.body || {};
  if (!appointmentId || !patientId || !reason?.trim())
    return failure(res, "VALIDATION_ERROR", "Consulta, paciente e justificativa são obrigatórios.", 422);

  const appointment = await prisma.$transaction(
    async (tx) => {
      const found = await tx.appointment.findFirst({
        where: { id: appointmentId, patientId },
      });
      if (!found) return null;
      if (cancelledStatuses.includes(found.status)) return found;

      const updated = await tx.appointment.update({
        where: { id: found.id },
        data: { status: "cancelado", justification: reason.trim() },
      });

      await createVacancyForNextPatient(tx, found.specialty, found.unit);
      return updated;
    },
    { maxWait: 5000, timeout: 10000 },
  );
  if (!appointment) return failure(res, "NOT_FOUND", "Consulta não encontrada.", 404);
  return success(res, appointment);
});

router.post("/appointments/confirm", async (req, res) => {
  const { appointmentId, patientId } = req.body || {};
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, patientId, status: { notIn: cancelledStatuses } },
  });
  if (!appointment) return failure(res, "NOT_FOUND", "Consulta não encontrada.", 404);
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { checkedIn: true },
  });
  return success(res, updated);
});

router.get("/waiting-list/position", async (req, res) => {
  const { patientId, specialty } = req.query;
  if (!patientId || !specialty)
    return failure(res, "VALIDATION_ERROR", "patientId e specialty são obrigatórios.", 422);
  const entry = await prisma.waitingList.findFirst({
    where: { patientId, specialty, status: "waiting" },
    orderBy: { createdAt: "asc" },
  });
  if (!entry) return success(res, { position: null, waiting: false });
  const position =
    (await prisma.waitingList.count({
      where: { specialty, status: "waiting", createdAt: { lt: entry.createdAt } },
    })) + 1;
  return success(res, { position, waiting: true });
});

router.post("/waiting-list/join", async (req, res) => {
  const { patientId, specialty } = req.body || {};
  if (!patientId || !specialty?.trim())
    return failure(res, "VALIDATION_ERROR", "Paciente e especialidade são obrigatórios.", 422);

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return failure(res, "NOT_FOUND", "Paciente não encontrado.", 404);

  const existing = await prisma.waitingList.findFirst({
    where: {
      patientId,
      specialty: specialty.trim(),
      status: { in: ["waiting", "notified"] },
    },
  });
  if (existing)
    return failure(
      res,
      "VALIDATION_ERROR",
      "Paciente já está na fila de espera para essa especialidade.",
      409,
    );

  const entry = await prisma.waitingList.create({
    data: { patientId, specialty: specialty.trim(), status: "waiting" },
  });
  const position =
    (await prisma.waitingList.count({
      where: {
        specialty: entry.specialty,
        status: "waiting",
        createdAt: { lt: entry.createdAt },
      },
    })) + 1;

  return success(res, {
    id: entry.id,
    patient_id: entry.patientId,
    specialty: entry.specialty,
    position,
  });
});

router.post("/waiting-list/respond", async (req, res) => {
  const { vacancyId, patientId, accepted } = req.body || {};
  if (!vacancyId || !patientId || typeof accepted !== "boolean")
    return failure(
      res,
      "VALIDATION_ERROR",
      "VacancyId, patientId e accepted são obrigatórios.",
      422,
    );

  try {
    const result = await prisma.$transaction(async (tx) => {
      const vacancy = await tx.vacancy.findFirst({ where: { id: vacancyId, patientId } });
      if (!vacancy) return null;
      if (vacancy.deadline <= new Date()) {
        await tx.vacancy.update({ where: { id: vacancy.id }, data: { status: "expired" } });
        await tx.waitingList.updateMany({
          where: { patientId, specialty: vacancy.specialty, status: "notified" },
          data: { status: "expired" },
        });
        await createVacancyForNextPatient(tx, vacancy.specialty, vacancy.unit);
        const error = new Error("O prazo para responder à vaga expirou.");
        error.code = "EXPIRED";
        throw error;
      }
      if (vacancy.status !== "waiting_response") {
        const error = new Error("A vaga não está disponível para resposta.");
        error.code = "UNAVAILABLE";
        throw error;
      }

      const updated = await tx.vacancy.update({
        where: { id: vacancy.id },
        data: { status: accepted ? "accepted" : "declined" },
      });
      await tx.waitingList.updateMany({
        where: { patientId, specialty: vacancy.specialty, status: "notified" },
        data: { status: accepted ? "accepted" : "declined" },
      });
      if (!accepted) {
        await createVacancyForNextPatient(tx, vacancy.specialty, vacancy.unit);
      }
      return updated;
    }, { maxWait: 5000, timeout: 10000 });

    if (!result) return failure(res, "NOT_FOUND", "Oferta de vaga não encontrada.", 404);
    return success(res, result);
  } catch (error) {
    if (error.code === "EXPIRED")
      return failure(res, "VALIDATION_ERROR", error.message, 409);
    if (error.code === "UNAVAILABLE")
      return failure(res, "VALIDATION_ERROR", error.message, 409);
    throw error;
  }
});

export default router;
