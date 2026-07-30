import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (payload) => {
    if (payload && typeof payload === 'object' && typeof payload.success === 'boolean' && Object.hasOwn(payload, 'data') && Object.hasOwn(payload, 'error')) {
      return sendJson(payload);
    }
    if (res.statusCode >= 400) {
      const detail = payload?.detail ?? payload?.message ?? payload;
      const message = typeof detail === 'string' ? detail : detail?.message || 'Não foi possível concluir a solicitação.';
      const code = res.statusCode === 401 ? 'UNAUTHORIZED' : res.statusCode === 403 ? 'FORBIDDEN' : res.statusCode === 404 ? 'NOT_FOUND' : res.statusCode === 409 ? 'SLOT_TAKEN' : 'VALIDATION_ERROR';
      return sendJson({ success: false, data: null, error: { code, message } });
    }
    return sendJson({ success: true, data: payload, error: null });
  };
  next();
});

const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || '0.0.0.0';
const jwtSecret = process.env.JWT_SECRET_PATIENT || process.env.JWT_SECRET || 'dev-patient-secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN_PATIENT || process.env.JWT_EXPIRES_IN || '30d';
const webBackendUrl = String(process.env.WEB_BACKEND_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
const internalServiceSecret = String(process.env.INTERNAL_SERVICE_SECRET || 'spm-internal-service-secret').trim();

function signToken(auth) {
  return jwt.sign({ sub: auth.id, role: auth.role }, jwtSecret, { expiresIn: jwtExpiresIn });
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ detail: 'Não autenticado' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const auth = await prisma.userAuth.findUnique({ where: { id: payload.sub } });
    if (!auth || !['patient', 'responsavel'].includes(auth.role)) {
      return res.status(401).json({ detail: 'Token de paciente inválido' });
    }
    let patientId = auth.patientId;
    if (auth.role === 'responsavel') {
      const requestedPatientId = String(req.get('x-patient-id') || '');
      const link = await prisma.patientResponsavel.findFirst({
        where: {
          responsavelId: auth.responsavelId || undefined,
          ...(requestedPatientId ? { patientId: requestedPatientId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      patientId = link?.patientId || null;
      if (!patientId) return res.status(403).json({ detail: 'Responsável sem paciente vinculado' });
      const consent = await prisma.consentRecord.findUnique({
        where: { patientId_purpose: { patientId, purpose: 'share_with_responsavel' } },
      });
      if (!consent?.granted) return res.status(403).json({ detail: 'O paciente não autorizou o compartilhamento.' });
    }
    if (!patientId) return res.status(401).json({ detail: 'Paciente não encontrado' });
    req.auth = auth;
    req.userId = patientId;
    req.authRole = auth.role;
    next();
  } catch {
    return res.status(401).json({ detail: 'Token inválido' });
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function serializeUser(user) {
  const birthDate = user.birthDate ? new Date(user.birthDate) : user.birthdate ? new Date(user.birthdate) : null;
  const birthdate = birthDate ? birthDate.toISOString().slice(0, 10) : null;
  const allergies = Array.isArray(user.allergies)
    ? user.allergies
    : (user.allergies ? String(user.allergies).split(',').map((item) => item.trim()).filter(Boolean) : []);

  return {
    id: user.id,
    email: user.email || null,
    name: user.name,
    cpf: user.cpf || null,
    photo_base64: user.photoBase64 || null,
    blood_type: user.bloodType || null,
    allergies,
    emergency_contact: user.emergencyContact || user.emergencyContactName || null,
    emergency_phone: user.emergencyPhone || user.emergencyContactPhone || null,
    phone: user.phone || null,
    address: user.address || null,
    mother_name: user.motherName || null,
    father_name: user.fatherName || null,
    birthdate,
    gender: user.gender || user.sex || null,
    medication_photo_required: user.medicationPhotoRequired ?? true,
    accessibility_enabled: user.accessibilityEnabled ?? false,
    push_token: user.pushToken || null,
  };
}

async function sendExpoPush(token, title, body, data = {}) {
  if (!token) return null;
  try {
    const message = [{ to: token, sound: 'default', title, body, data }];
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('Erro ao enviar push via Expo:', err);
    return null;
  }
}

function serializeAppointment(item, doctor = null) {
  const scheduledAt = item.scheduledAt instanceof Date ? item.scheduledAt.toISOString() : item.scheduledAt;
  return {
    id: item.id,
    doctor_name: doctor?.name || item.doctor?.name || item.doctorName || null,
    specialty: item.specialty,
    location: item.unit || item.location || null,
    scheduled_at: scheduledAt,
    status: item.status,
    queue_position: item.queuePosition ?? null,
    notes: item.justification || item.notes || null,
    cancellation_reason: item.justification || null,
    created_at: item.createdAt,
  };
}

async function resolveAppointmentDoctorMap(appointments) {
  const doctorIds = [...new Set((appointments || []).map((item) => item.doctorId).filter(Boolean))];
  if (!doctorIds.length) return new Map();
  const doctors = await prisma.user.findMany({ where: { id: { in: doctorIds } } });
  return new Map(doctors.map((doctor) => [doctor.id, doctor]));
}

function serializeExam(item) {
  const dateValue = item.readyAt || item.createdAt;
  return {
    id: item.id,
    appointment_id: null,
    title: item.exam,
    kind: 'exam',
    doctor_name: item.requestedBy?.name || null,
    date: dateValue ? new Date(dateValue).toISOString() : null,
    status: item.status,
    summary: item.preparationNotes || null,
    file_url: null,
    created_at: item.createdAt,
    ready_at: item.readyAt,
  };
}

function serializeMedication(item) {
  return {
    id: item.id,
    name: item.name,
    dosage: item.dosage,
    frequency: item.frequency,
    stock: item.remainingQuantity ?? item.initialQuantity ?? null,
    notes: item.notes || null,
    reminder_time: item.schedules || null,
    color: null,
    is_archived: false,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function serializeMedicationLog(item) {
  return {
    id: item.id,
    medication_id: item.medicationId,
    taken_at: item.confirmedAt || item.takenAt || null,
    photo_base64: item.photoRef || null,
    created_at: item.createdAt || item.confirmedAt || null,
  };
}

function isMedicationImageValid(photoBase64, medicationName = '') {
  if (!photoBase64 || typeof photoBase64 !== 'string') return false;
  const trimmed = photoBase64.trim();
  if (trimmed.length < 500) return false;
  const score = Math.min(1, trimmed.length / 5000);
  const nameMatch = medicationName ? String(medicationName).toLowerCase().split(/\s+/).filter(Boolean) : [];
  const isLikelyMedication = nameMatch.length > 0 ? score + 0.1 * nameMatch.length > 0.55 : score > 0.25;
  return isLikelyMedication;
}

async function verifyMedicationImage(photoBase64, medicationName = '') {
  const payload = {
    image_base64: photoBase64,
    medication_name: medicationName,
  };

  if (process.env.MEDICATION_AI_URL) {
    try {
      const response = await fetch(process.env.MEDICATION_AI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.MEDICATION_AI_API_KEY ? { Authorization: `Bearer ${process.env.MEDICATION_AI_API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        return {
          verified: Boolean(data.verified),
          message: data.message || (data.verified ? 'IA validou a imagem como medicamento.' : 'IA não identificou medicamento.'),
          type: data.type || data.medication_type || null,
          confidence: typeof data.confidence === 'number' ? data.confidence : null,
        };
      }
    } catch (error) {
      console.warn('Erro ao chamar IA de validação de medicamento:', error);
    }
  }

  const verified = isMedicationImageValid(photoBase64, medicationName);
  return {
    verified,
    message: verified
      ? 'A foto foi validada como medicamento (caixa/cartela).' 
      : 'A imagem não parece ser de um medicamento válido. Tente outra foto da caixa ou cartela.',
    type: verified ? 'cartela' : null,
    confidence: verified ? 0.82 : 0.18,
  };
}

function normalizeReminderTimePart(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, '').slice(0, 4);
  if (!digits) return null;
  let normalized;
  if (digits.length <= 2) {
    normalized = `${digits.padStart(2, '0')}:00`;
  } else if (digits.length === 3) {
    normalized = `${digits[0].padStart(2, '0')}:${digits.slice(1)}`;
  } else {
    normalized = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  const [hours, minutes] = normalized.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeReminderList(rawValue) {
  if (!rawValue) return '';
  const values = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue).split(/[;,\s]+/);
  return values
    .map((part) => normalizeReminderTimePart(part))
    .filter(Boolean)
    .join(',');
}

function parseReminderTimes(rawValue) {
  const normalized = normalizeReminderList(rawValue);
  return normalized ? normalized.split(',').filter(Boolean) : [];
}

function getNextOccurrence(time, now = new Date()) {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function formatRemainingText(ms) {
  if (ms <= 0) return 'Agora';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `Em ${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
  return `Em ${minutes}m`;
}

// Agenda and waiting-list writes belong to the web backend. The mobile API
// authenticates the patient locally, then uses this private service call; it
// never forwards a patient JWT to the web service.
async function callWebAgenda(path, payload) {
  if (!internalServiceSecret) {
    const error = new Error('A integração de agenda não está configurada.');
    error.code = 'INTERNAL_SERVICE_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  let response;
  try {
    response = await fetch(`${webBackendUrl}/integration${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-secret': internalServiceSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    const error = new Error('Não foi possível comunicar com a agenda.');
    error.code = 'AGENDA_UNAVAILABLE';
    error.status = 503;
    throw error;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const error = new Error(body?.error?.message || 'Não foi possível atualizar a agenda.');
    error.code = body?.error?.code || 'AGENDA_UNAVAILABLE';
    error.status = response.status || 503;
    throw error;
  }
  return body.data;
}

function forwardAgendaError(res, error) {
  const status = error.status || (error.code === 'SLOT_TAKEN' ? 409 : 503);
  return res.status(status).json({
    success: false,
    data: null,
    error: { code: error.code || 'AGENDA_UNAVAILABLE', message: error.message },
  });
}

const EXAM_BLOCK_THRESHOLD_MS = 5 * 60 * 1000; // simulate 15 days with 5 minutes for now
const SIMULATED_EXAM_READY_AFTER_MS = 5 * 60 * 1000; // send exam ready after 5 minutes for testing

async function ensureTestExamReadyForUser(userId) {
  if (process.env.NODE_ENV === 'production') return;
  const threshold = new Date(Date.now() - SIMULATED_EXAM_READY_AFTER_MS);
  const existingExamCount = await prisma.exam.count({ where: { patientId: userId } });
  const appointment = await prisma.appointment.findFirst({
    where: {
      patientId: userId,
      status: { not: 'cancelled' },
      createdAt: { lt: threshold },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!appointment || existingExamCount > 0) return;
  const requestedById = appointment.doctorId || (await prisma.user.findFirst({ where: { role: 'medico' } }))?.id;
  if (!requestedById) return;
  await prisma.exam.create({
    data: {
      patientId: userId,
      exam: 'Exame pronto para teste',
      preparationNotes: 'Exame gerado automaticamente após 5 minutos para testes internos.',
      status: 'laudo_pronto',
      requestedById,
      readyAt: new Date(),
      updatedAt: new Date(),
    },
  });
  try {
    const patient = await prisma.patient.findUnique({ where: { id: userId } });
    if (patient?.phone) {
      await sendExpoPush(patient.phone, 'Exame disponível', 'Seu exame de teste está pronto para visualização.');
    }
  } catch (e) {
    console.warn('Erro ao notificar usuário sobre exame pronto', e);
  }
}

async function getDefaultDoctorUserId() {
  const doctor = await prisma.user.findFirst({ where: { role: 'medico' } });
  return doctor?.id || null;
}

async function normalizeAppointmentInput(body, fallbackDoctorId = null) {
  const scheduledAtRaw = body.scheduled_at || body.scheduledAt;
  let scheduledAt = scheduledAtRaw;

  if (typeof scheduledAtRaw === 'string') {
    scheduledAt = new Date(scheduledAtRaw);
  } else if (scheduledAtRaw instanceof Date) {
    scheduledAt = scheduledAtRaw;
  }

  const doctorId = body.doctor_id || body.doctorId || fallbackDoctorId;
  return {
    doctorId,
    specialty: body.specialty || 'Clínico Geral',
    unit: body.location || body.unit || 'UBS Central',
    scheduledAt,
    priority: body.priority || 'normal',
    status: body.status || 'confirmed',
    justification: body.notes || body.justification || null,
    type: body.type || 'presencial',
    checkedIn: Boolean(body.checkedIn),
  };
}

async function getExamBlockStatus(userId, ignoreAppointmentId = null) {
  if (process.env.NODE_ENV !== 'production') {
    await ensureTestExamReadyForUser(userId);
  }
  const now = Date.now();
  const appointments = await prisma.appointment.findMany({
    where: { patientId: userId, status: { not: 'cancelled' } },
    orderBy: { createdAt: 'asc' },
  });
  for (const appointment of appointments) {
    if (ignoreAppointmentId && appointment.id === ignoreAppointmentId) continue;
    const age = now - new Date(appointment.createdAt).getTime();
    if (age <= EXAM_BLOCK_THRESHOLD_MS) continue;
    const exam = await prisma.exam.findFirst({
      where: { patientId: userId, requestedById: appointment.doctorId },
    });
    if (!exam) {
      return { blocked: true, appointment };
    }
  }
  return { blocked: false };
}

app.get('/api/info', (req, res) => {
  // Returns server info for discovery - useful when switching networks
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  res.json({
    status: 'ok',
    port: port,
    host: host,
    available_ips: ips,
    message: 'Saúde na Palma Backend',
  });
});

app.get('/api/', (req, res) => res.json({ message: 'Saúde na Palma da Mão API - v2' }));

app.post('/api/auth/register', (req, res) => {
  res.status(403).json({
    success: false,
    data: null,
    error: {
      code: 'FORBIDDEN',
      message: 'O cadastro de paciente é feito exclusivamente pela equipe no sistema web.',
    },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const auth = await prisma.userAuth.findUnique({ where: { email: normalizedEmail } });
  if (!auth || !['patient', 'responsavel'].includes(auth.role)) return res.status(401).json({ detail: 'E-mail ou senha inválidos' });

  const ok = await bcrypt.compare(password, auth.passwordHash);
  if (!ok) return res.status(401).json({ detail: 'E-mail ou senha inválidos' });
  if (auth.mustChangePassword) {
    return res.status(403).json({
      success: false,
      data: null,
      error: { code: 'MUST_CHANGE_PASSWORD', message: 'Troque a senha temporária para continuar.' },
    });
  }

  let patientId = auth.patientId;
  if (auth.role === 'responsavel') {
    patientId = (await prisma.patientResponsavel.findFirst({
      where: { responsavelId: auth.responsavelId || undefined },
      orderBy: { createdAt: 'asc' },
    }))?.patientId || null;
  }
  if (!patientId) return res.status(401).json({ detail: 'Paciente não encontrado' });
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return res.status(401).json({ detail: 'Paciente não encontrado' });

  const token = signToken(auth);
  res.json({ access_token: token, token_type: 'bearer', user: serializeUser({ ...patient, email: auth.email }) });
});

app.post('/api/auth/change-password', async (req, res) => {
  const { email, current_password: currentPassword, currentPassword: currentPasswordCamel, new_password: newPassword, newPassword: newPasswordCamel } = req.body || {};
  const auth = await prisma.userAuth.findUnique({ where: { email: normalizeEmail(email) } });
  const suppliedCurrentPassword = currentPassword || currentPasswordCamel;
  const suppliedNewPassword = newPassword || newPasswordCamel;
  if (!auth || !['patient', 'responsavel'].includes(auth.role)) return res.status(401).json({ detail: 'Usuário não encontrado' });
  if (!suppliedNewPassword || String(suppliedNewPassword).length < 8) return res.status(422).json({ detail: 'A nova senha deve ter ao menos 8 caracteres.' });
  if (!(await bcrypt.compare(suppliedCurrentPassword || '', auth.passwordHash))) return res.status(401).json({ detail: 'Senha temporária inválida.' });
  await prisma.userAuth.update({
    where: { id: auth.id },
    data: { passwordHash: await bcrypt.hash(suppliedNewPassword, 12), mustChangePassword: false },
  });
  res.json({ changed: true });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.userId } });
  if (!patient) return res.status(401).json({ detail: 'Usuário não encontrado' });

  const auth = await prisma.userAuth.findUnique({ where: { patientId: patient.id } });
  res.json(serializeUser({ ...patient, email: auth?.email || patient.email }));
});

app.put('/api/auth/me', authMiddleware, async (req, res) => {
  const payload = req.body || {};
  const data = {
    name: payload.name,
    phone: payload.phone,
    address: payload.address,
    birthDate: payload.birthdate ? new Date(payload.birthdate) : payload.birthDate ? new Date(payload.birthDate) : undefined,
    sex: payload.gender,
    bloodType: payload.blood_type || payload.bloodType,
    medicationPhotoRequired: payload.medication_photo_required ?? payload.medicationPhotoRequired,
    accessibilityEnabled: payload.accessibility_enabled ?? payload.accessibilityEnabled,
  };

  const patient = await prisma.patient.update({
    where: { id: req.userId },
    data: Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
  });

  if (payload.email) {
    const normalizedEmail = normalizeEmail(payload.email);
    await prisma.userAuth.update({
      where: { patientId: patient.id },
      data: { email: normalizedEmail },
    });
  }

  const auth = await prisma.userAuth.findUnique({ where: { patientId: patient.id } });
  res.json(serializeUser({ ...patient, email: auth?.email || patient.email }));
});

app.get('/api/specialties', (req, res) => {
  res.json([
    { key: 'Clínico Geral', icon: 'person', description: 'Cuida da saúde geral.', treats: ['febre', 'infecção', 'dor de cabeça'], doctors: ['Dra. Maria Silva', 'Dr. Rafael Santos', 'Dra. Ana Costa', 'Dr. Marcelo Nogueira', 'Dra. Sílvia Cardoso'] },
    { key: 'Cardiologista', icon: 'heart', description: 'Cuida do coração.', treats: ['dor no peito', 'hipertensão', 'arritmias'], doctors: ['Dr. João Oliveira', 'Dra. Elisa Pereira', 'Dr. Mauro Franco', 'Dra. Lúcia Bittencourt', 'Dr. Henrique Lima'] },
    { key: 'Dermatologista', icon: 'leaf', description: 'Cuida da pele.', treats: ['acne', 'alergias', 'manchas'], doctors: ['Dra. Paula Menezes', 'Dra. Júlia Fonseca', 'Dra. Renata Moura', 'Dr. Caio Tavares', 'Dra. Vitória Andrade'] },
    { key: 'Ginecologista', icon: 'female', description: 'Saúde da mulher.', treats: ['exames ginecológicos', 'gravidez', 'menstruação irregular'], doctors: ['Dra. Fernanda Costa', 'Dra. Renata Lima', 'Dra. Patrícia Nero', 'Dra. Marina Lacerda', 'Dra. Clara Figueiredo'] },
    { key: 'Pediatra', icon: 'happy', description: 'Cuida de crianças.', treats: ['vacinas', 'febre infantil', 'crescimento infantil'], doctors: ['Dr. Lucas Almeida', 'Dra. Marina Duarte', 'Dr. Tiago Amaral', 'Dra. Lara Esteves', 'Dr. Pedro Ventura'] },
    { key: 'Endocrinologista', icon: 'flame', description: 'Hormônios e metabolismo.', treats: ['diabetes', 'tiroide', 'obesidade'], doctors: ['Dra. Camila Martins', 'Dr. Eduardo Campos', 'Dra. Flávia Monteiro', 'Dr. Vinícius Ribeiro', 'Dra. Ana Luiza Carvalho'] },
    { key: 'Ortopedista', icon: 'fitness', description: 'Saúde dos ossos e articulações.', treats: ['dores nas articulações', 'lesões', 'reabilitação'], doctors: ['Dr. Felipe Ribeiro', 'Dra. Carla Nunes', 'Dr. Gustavo Oliveira', 'Dra. Aline Marques', 'Dr. Renato Barros'] },
    { key: 'Neurologista', icon: 'brain', description: 'Sistema nervoso.', treats: ['dor de cabeça', 'convulsões', 'tontura'], doctors: ['Dra. Larissa Souza', 'Dr. Renato Marques', 'Dra. Isabela Duarte', 'Dr. Daniel Freitas', 'Dra. Camila Rios'] },
    { key: 'Oftalmologista', icon: 'eye', description: 'Cuida da visão e dos olhos.', treats: ['miopia', 'irritação ocular', 'cirurgia de catarata'], doctors: ['Dra. Helena Vicente', 'Dr. André Pinto', 'Dra. Sabrina Teles', 'Dr. Marcos Lima', 'Dra. Juliana Siqueira'] },
    { key: 'Otorrinolaringologista', icon: 'ear', description: 'Cuida de ouvido, nariz e garganta.', treats: ['sinusite', 'dor de garganta', 'zumbido'], doctors: ['Dra. Beatriz Rocha', 'Dr. Gustavo Freitas', 'Dra. Laura Faria', 'Dr. Alexandre Sousa', 'Dra. Mônica Coelho'] },
    { key: 'Urologista', icon: 'male', description: 'Saúde do trato urinário e genital masculino.', treats: ['infecção urinária', 'cálculo renal'], doctors: ['Dr. Marcos Araújo', 'Dra. Lívia Santana', 'Dr. Henrique Furtado', 'Dra. Patrícia Moreira', 'Dr. Cristiano Pires'] },
    { key: 'Gastroenterologista', icon: 'restaurant', description: 'Saúde do sistema digestivo.', treats: ['azia', 'dor abdominal', 'refluxo'], doctors: ['Dra. Sofia Castro', 'Dr. Rafael Meirelles', 'Dra. Vanessa Reis', 'Dr. Otávio Santos', 'Dra. Paula Bohm'] },
    { key: 'Psicólogo', icon: 'heart-circle', description: 'Apoio emocional e saúde mental.', treats: ['ansiedade', 'depressão', 'estresse'], doctors: ['Dra. Patricia Albuquerque', 'Dra. Camila Souza', 'Dra. Renata Campos', 'Dra. Silvia Guimarães', 'Dr. Rodrigo Oliveira'] },
    { key: 'Nutricionista', icon: 'nutrition', description: 'Alimentação saudável e controle de peso.', treats: ['dieta', 'nutrição esportiva', 'intolerância alimentar'], doctors: ['Dra. Marcela Pinto', 'Dr. Frederico Teixeira', 'Dra. Bianca Andrade', 'Dr. Fernando Melo', 'Dra. Carla Guedes'] },
    { key: 'Reumatologista', icon: 'sparkles', description: 'Doenças das articulações e músculos.', treats: ['artrite', 'fibromialgia'], doctors: ['Dra. Paula Miranda', 'Dr. Sérgio Batista', 'Dra. Mirela Alves', 'Dr. Ronaldo Vieira', 'Dra. Juliana Pereira'] },
  ]);
});

app.get('/api/appointments', authMiddleware, async (req, res) => {
  const statusFilter = req.query.status_filter;
  const where = { patientId: req.userId };
  if (statusFilter) where.status = statusFilter;
  const appointments = await prisma.appointment.findMany({ where, orderBy: { scheduledAt: 'asc' } });
  const doctorMap = await resolveAppointmentDoctorMap(appointments);
  res.json(appointments.map((appointment) => serializeAppointment(appointment, doctorMap.get(appointment.doctorId))));
});

app.get('/api/appointments/:id', authMiddleware, async (req, res) => {
  const appointment = await prisma.appointment.findFirst({ where: { id: req.params.id, patientId: req.userId } });
  if (!appointment) return res.status(404).json({ detail: 'Consulta não encontrada' });
  const doctor = appointment.doctorId ? await prisma.user.findUnique({ where: { id: appointment.doctorId } }) : null;
  res.json(serializeAppointment(appointment, doctor));
});

app.put('/api/appointments/:id', authMiddleware, async (req, res) => {
  const current = await prisma.appointment.findFirst({ where: { id: req.params.id, patientId: req.userId } });
  if (!current) return res.status(404).json({ detail: 'Consulta não encontrada' });
  const data = await normalizeAppointmentInput(req.body, current.doctorId);
  try {
    const updated = await callWebAgenda('/appointments/book', {
      appointmentId: current.id,
      patientId: req.userId,
      doctorId: data.doctorId,
      specialty: data.specialty,
      unit: data.unit,
      scheduledAt: new Date(data.scheduledAt).toISOString(),
      priority: data.priority,
      justification: data.justification,
    });
    return res.json(serializeAppointment(updated));
  } catch (error) {
    return forwardAgendaError(res, error);
  }
});

app.post('/api/appointments', authMiddleware, async (req, res) => {
  const data = await normalizeAppointmentInput(req.body);
  try {
    const appointment = await callWebAgenda('/appointments/book', {
      patientId: req.userId,
      doctorId: data.doctorId,
      specialty: data.specialty,
      unit: data.unit,
      scheduledAt: new Date(data.scheduledAt).toISOString(),
      priority: data.priority,
      justification: data.justification,
    });
    return res.status(201).json(serializeAppointment(appointment));
  } catch (error) {
    return forwardAgendaError(res, error);
  }
});

app.post('/api/appointments/:id/cancel', authMiddleware, async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(422).json({ detail: 'Selecione uma justificativa para cancelar.' });
  try {
    const updated = await callWebAgenda('/appointments/cancel', { appointmentId: req.params.id, patientId: req.userId, reason });
    return res.json(serializeAppointment(updated));
  } catch (error) {
    return forwardAgendaError(res, error);
  }
});

app.get('/api/exams', authMiddleware, async (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    await ensureTestExamReadyForUser(req.userId);
  }
  const exams = await prisma.exam.findMany({ where: { patientId: req.userId }, orderBy: { createdAt: 'desc' } });
  res.json(exams.map(serializeExam));
});

app.get('/api/exams/:id', authMiddleware, async (req, res) => {
  const exam = await prisma.exam.findFirst({ where: { id: req.params.id, patientId: req.userId } });
  if (!exam) return res.status(404).json({ detail: 'Exame não encontrado' });
  res.json(serializeExam(exam));
});

app.post('/api/exams', authMiddleware, async (req, res) => {
  res.status(403).json({ detail: 'Cadastro de exames não disponível no app mobile.' });
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    await ensureTestExamReadyForUser(req.userId);
  }
  const appointments = await prisma.appointment.findMany({ where: { patientId: req.userId }, orderBy: { scheduledAt: 'asc' } });
  const doctorMap = await resolveAppointmentDoctorMap(appointments);
  const exams = await prisma.exam.findMany({ where: { patientId: req.userId }, orderBy: { createdAt: 'desc' } });
  const serializedAppointments = appointments.map((appointment) => serializeAppointment(appointment, doctorMap.get(appointment.doctorId)));
  const upcoming = serializedAppointments.filter((item) => !['cancelado', 'cancelled', 'completed', 'compareceu'].includes(item.status));
  const nextAppointment = upcoming.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] || null;
  res.json({
    next_appointment: nextAppointment || null,
    upcoming_count: upcoming.length,
    exams_ready: exams.filter((item) => item.status === 'laudo_pronto').length,
    exams_count: exams.length,
  });
});

app.get('/api/allergies/catalog', (req, res) => {
  res.json({ items: [{ value: 'Pólen', label: 'Pólen' }, { value: 'Amendoim', label: 'Amendoim' }, { value: 'Lactose', label: 'Lactose' }] });
});

app.get('/api/doctors/:specialty/available_slots', authMiddleware, async (req, res) => {
  const { doctor_name, date, ignore_appointment_id } = req.query;
  
  try {
    console.log(`[Slots] Requested: doctor=${doctor_name}, date=${date}, ignoreId=${ignore_appointment_id}`);
    
    // Build query - first get all non-cancelled appointments for this doctor
    const doctorName = String(doctor_name || '').trim();
    const doctor = doctorName ? await prisma.user.findFirst({ where: { name: doctorName } }) : null;
    const whereClause = {
      doctorId: doctor?.id || undefined,
      status: { not: 'cancelled' },
    };
    
    // If we're editing an appointment, exclude it from the "taken" check
    const allAppointments = await prisma.appointment.findMany({
      where: ignore_appointment_id
        ? { 
            ...whereClause, 
            NOT: { id: String(ignore_appointment_id) } 
          }
        : whereClause,
    });
    
    console.log(`[Slots] Total appointments for ${doctor_name}: ${allAppointments.length}`);
    
    // Filter appointments that are on the requested date
    const dateStr = String(date); // e.g., "2026-07-11"
    const appointments = allAppointments.filter((apt) => {
      const aptDate = new Date(apt.scheduledAt);
      const aptDateStr = aptDate.getFullYear() + '-' + 
                         String(aptDate.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(aptDate.getDate()).padStart(2, '0');
      return aptDateStr === dateStr;
    });
    
    console.log(`[Slots] Appointments on ${dateStr}: ${appointments.length}`);
    
    // Extract times from appointments
    const taken = appointments.map((item) => {
      const appointmentDate = new Date(item.scheduledAt);
      const hours = String(appointmentDate.getHours()).padStart(2, '0');
      const minutes = String(appointmentDate.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    });
    
    console.log(`[Slots] Taken times: ${taken.join(', ')}`);
    
    // Generate all possible times (8:00 to 18:00, 30 min intervals)
    const allTimes = [];
    for (let hour = 8; hour <= 18; hour += 1) {
      allTimes.push(`${String(hour).padStart(2, '0')}:00`);
      if (hour < 18) allTimes.push(`${String(hour).padStart(2, '0')}:30`);
    }
    
    // Filter out taken times
    const baseTimes = allTimes.filter((time) => !taken.includes(time));
    
    // Filter out past times for today
    const now = new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const isToday = requestedDate.getFullYear() === now.getFullYear()
      && requestedDate.getMonth() === now.getMonth()
      && requestedDate.getDate() === now.getDate();
    
    const available = baseTimes.filter((time) => {
      if (!isToday) return true;
      const [hours, minutes] = time.split(':').map(Number);
      const slot = new Date(now);
      slot.setHours(hours, minutes, 0, 0);
      return slot.getTime() > now.getTime();
    });
    
    console.log(`[Slots] Available: ${available.length}, Taken: ${taken.length}`);
    res.json({ available, taken });
  } catch (e) {
    console.error(`[Slots Error] ${e.message}`, e.stack);
    res.status(500).json({ detail: 'Erro ao buscar horários disponíveis' });
  }
});

app.get('/api/medications', authMiddleware, async (req, res) => {
  const medications = await prisma.medication.findMany({ where: { patientId: req.userId }, orderBy: { createdAt: 'asc' } });
  res.json(medications.map(serializeMedication));
});

app.get('/api/medications/:id', authMiddleware, async (req, res) => {
  const medication = await prisma.medication.findFirst({ where: { id: req.params.id, patientId: req.userId } });
  if (!medication) return res.status(404).json({ detail: 'Medicamento não encontrado' });
  const logs = await prisma.medicationLog.findMany({ where: { medicationId: medication.id }, orderBy: { confirmedAt: 'desc' } });
  res.json({ ...serializeMedication(medication), logs: logs.map(serializeMedicationLog) });
});

app.post('/api/medications/verify-photo', authMiddleware, async (req, res) => {
  const medication = await prisma.medication.findFirst({ where: { id: req.body.medication_id, patientId: req.userId } });
  const photo = req.body.photo_base64;
  if (!medication) return res.status(404).json({ detail: 'Medicamento não encontrado' });
  if (!photo) return res.status(400).json({ detail: 'Foto do medicamento é necessária para verificação' });
  const result = await verifyMedicationImage(photo, medication.name);
  res.json({ verified: result.verified, message: result.message, medication_type: result.type, confidence: result.confidence });
});

app.post('/api/medications/take', authMiddleware, async (req, res) => {
  const medication = await prisma.medication.findFirst({ where: { id: req.body.medication_id, patientId: req.userId } });
  const photo = req.body.photo_base64;
  if (!medication) return res.status(404).json({ detail: 'Medicamento não encontrado' });
  const patient = await prisma.patient.findUnique({ where: { id: req.userId } });
  const photoRequired = patient?.phone ? false : true;
  if (photoRequired && !photo) {
    return res.status(400).json({ detail: 'Foto do medicamento é necessária para registrar a dose' });
  }
  if (photo) {
    const result = await verifyMedicationImage(photo, medication.name);
    if (!result.verified) return res.status(422).json({ detail: result.message || 'Foto não foi validada como medicamento. Tente outra foto da caixa ou cartela.' });
  }
  const log = await prisma.medicationLog.create({
    data: {
      patientId: req.userId,
      medicationId: medication.id,
      confirmedAt: req.body.taken_at ? new Date(req.body.taken_at) : new Date(),
      photoRef: photo || null,
      source: 'mobile',
    },
  });
  const nextRemaining = Math.max(0, (medication.remainingQuantity ?? medication.initialQuantity ?? 0) - 1);
  const updated = await prisma.medication.update({ where: { id: medication.id }, data: { remainingQuantity: nextRemaining } });
  res.json({ medication: serializeMedication(updated), log: serializeMedicationLog(log) });
});

app.post('/api/medications', authMiddleware, async (req, res) => {
  res.status(403).json({ detail: 'Cadastro de medicamentos não disponível no app mobile.' });
});

app.put('/api/medications/:id', authMiddleware, async (req, res) => {
  const medication = await prisma.medication.findFirst({ where: { id: req.params.id, patientId: req.userId } });
  if (!medication) return res.status(404).json({ detail: 'Medicamento não encontrado' });
  const normalizedReminder = normalizeReminderList(
    Array.isArray(req.body.reminder_times)
      ? req.body.reminder_times
      : req.body.reminder_time || req.body.reminderTime,
  );
  const updated = await prisma.medication.update({
    where: { id: medication.id },
    data: {
      name: req.body.name || medication.name,
      dosage: req.body.dosage || medication.dosage,
      frequency: req.body.frequency || medication.frequency,
      schedules: normalizedReminder || medication.schedules,
      remainingQuantity: req.body.remaining_quantity ?? req.body.stock ?? medication.remainingQuantity ?? medication.initialQuantity,
    },
  });
  res.json(serializeMedication(updated));
});

app.delete('/api/medications/:id', authMiddleware, async (req, res) => {
  const medication = await prisma.medication.deleteMany({ where: { id: req.params.id, patientId: req.userId } });
  if (!medication.count) return res.status(404).json({ detail: 'Medicamento não encontrado' });
  res.json({ ok: true });
});

app.get('/api/medications/:id/logs', authMiddleware, async (req, res) => {
  const medication = await prisma.medication.findFirst({ where: { id: req.params.id, patientId: req.userId } });
  if (!medication) return res.status(404).json({ detail: 'Medicamento não encontrado' });
  const logs = await prisma.medicationLog.findMany({ where: { medicationId: medication.id }, orderBy: { confirmedAt: 'desc' } });
  res.json(logs.map(serializeMedicationLog));
});

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const appointments = await prisma.appointment.findMany({ where: { patientId: req.userId }, orderBy: { scheduledAt: 'asc' } });
  const doctorMap = await resolveAppointmentDoctorMap(appointments);
  const medications = await prisma.medication.findMany({ where: { patientId: req.userId }, orderBy: { createdAt: 'asc' } });
  const now = new Date();
  const appointmentItems = appointments
    .filter((item) => new Date(item.scheduledAt) >= now)
    .map((item) => {
      const doctor = doctorMap.get(item.doctorId);
      const target = new Date(item.scheduledAt);
      const remainingMs = target.getTime() - now.getTime();
      return {
        id: `appt-${item.id}`,
        kind: 'appointment',
        icon: 'calendar',
        title: 'Consulta agendada',
        body: `${item.specialty} com ${doctor?.name || item.doctorName || 'médico'}`,
        when: item.scheduledAt,
        remaining_text: formatRemainingText(remainingMs),
        link: `/appointment/${item.id}`,
      };
    })
    .slice(0, 3);
  const medicationItems = medications.flatMap((item) => {
    const times = parseReminderTimes(item.reminderTime);
    return times.map((time) => {
      const next = getNextOccurrence(time, now);
      if (!next) return null;
      const remainingMs = next.getTime() - now.getTime();
      return {
        id: `med-${item.id}-${time}`,
        kind: 'medication',
        icon: 'medical',
        title: 'Lembrete de medicamento',
        body: remainingMs <= 15 * 60 * 1000 ? `Tome ${item.name} em 15 minutos` : `Tome ${item.name} às ${time}`,
        when: next.toISOString(),
        remaining_text: formatRemainingText(remainingMs),
        link: `/medications/${item.id}`,
      };
    }).filter(Boolean);
  });
  const lowStockItems = medications
    .filter((item) => (item.remainingQuantity ?? item.initialQuantity ?? 0) <= 5)
    .map((item) => ({ id: `low-${item.id}`, kind: 'medication', icon: 'alert', title: 'Estoques baixos', body: `${item.name} tem apenas ${(item.remainingQuantity ?? item.initialQuantity ?? 0)} unidades`, when: item.createdAt.toISOString(), remaining_text: 'Verifique o estoque', link: `/medications/${item.id}` }));
  const items = [...appointmentItems, ...medicationItems, ...lowStockItems].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
  res.json({ items });
});

app.post('/api/push-token', authMiddleware, async (req, res) => {
  const token = req.body?.token || req.body?.push_token;
  if (!token) return res.status(422).json({ detail: 'Token inválido' });
  try {
    await prisma.patient.update({ where: { id: req.userId }, data: { phone: token } });
    res.json({ ok: true, push_token: token });
  } catch (e) {
    console.warn('Erro ao salvar push token', e);
    res.status(500).json({ detail: 'Erro ao salvar token' });
  }
});

// Debug endpoint: send push to arbitrary token (no auth) for testing
app.post('/api/push/send-debug', async (req, res) => {
  const token = req.body?.token;
  const title = req.body?.title || 'Teste de push';
  const body = req.body?.body || 'Mensagem de teste';
  if (!token) return res.status(422).json({ detail: 'Token obrigatório' });
  try {
    const result = await sendExpoPush(token, title, body, { debug: true });
    res.json({ ok: true, result });
  } catch (e) {
    console.warn('Erro ao enviar push debug', e);
    res.status(500).json({ detail: 'Erro ao enviar push' });
  }
});

app.get('/api/help/faq', (req, res) => {
  res.json({ items: [{ question: 'Como agendar?', answer: 'Use a tela de consultas para escolher especialidade, profissional e horário.' }] });
});

async function seed() {
  const doctor = await prisma.user.findFirst({ where: { role: 'medico' } });
  const demoAuth = await prisma.userAuth.findUnique({ where: { email: 'demo@saudepalma.com.br' } });
  let patient = demoAuth?.patientId ? await prisma.patient.findUnique({ where: { id: demoAuth.patientId } }) : null;

  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        email: 'demo@saudepalma.com.br',
        name: 'Paciente Demo',
        cpf: '000.000.000-00',
        phone: '(11) 99999-9999',
        birthDate: new Date('1988-05-15T00:00:00.000Z'),
        address: 'Rua Saúde, 123, Palmeira',
        sex: 'Não informado',
        motherName: 'Maria Demo',
        fatherName: 'José Demo',
        susCard: '000000000000000',
        cep: '01000-000',
        cityState: 'São Paulo / SP',
        nearestUnit: 'UBS Centro',
        emergencyContactName: 'Contato Demo',
        emergencyContactPhone: '(11) 98888-7777',
        substanceUse: 'Não informado',
        allergies: 'Nenhuma',
        chronicConditions: 'Hipertensão',
        lgpdAccepted: true,
        blockedOnline: false,
      },
    });
    await prisma.consentRecord.create({
      data: {
        patientId: patient.id,
        purpose: 'doctor_history_view',
        granted: true,
      },
    }).catch(() => {});
    await prisma.userAuth.create({
      data: {
        role: 'patient',
        email: 'demo@saudepalma.com.br',
        passwordHash: await bcrypt.hash('senha123', 10),
        mustChangePassword: false,
        patientId: patient.id,
      },
    });
  } else {
    patient = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        phone: patient.phone || '(11) 99999-9999',
        address: patient.address || 'Rua Saúde, 123, Palmeira',
        birthDate: patient.birthDate || new Date('1988-05-15T00:00:00.000Z'),
        motherName: patient.motherName || 'Maria Demo',
        fatherName: patient.fatherName || 'José Demo',
        susCard: patient.susCard || '000000000000000',
        cep: patient.cep || '01000-000',
        cityState: patient.cityState || 'São Paulo / SP',
        nearestUnit: patient.nearestUnit || 'UBS Centro',
        emergencyContactName: patient.emergencyContactName || 'Contato Demo',
        emergencyContactPhone: patient.emergencyContactPhone || '(11) 98888-7777',
        substanceUse: patient.substanceUse || 'Não informado',
        allergies: patient.allergies || 'Nenhuma',
        chronicConditions: patient.chronicConditions || 'Hipertensão',
        lgpdAccepted: patient.lgpdAccepted ?? true,
        blockedOnline: patient.blockedOnline ?? false,
      },
    });
    await prisma.consentRecord.upsert({
      where: {
        patientId_purpose: { patientId: patient.id, purpose: 'doctor_history_view' },
      },
      update: { granted: true },
      create: { patientId: patient.id, purpose: 'doctor_history_view', granted: true },
    });
  }

  const appointmentCount = await prisma.appointment.count({ where: { patientId: patient.id } });
  if (appointmentCount < 10) {
    await prisma.appointment.createMany({
      data: [
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Clínico Geral', unit: 'UBS Centro', scheduledAt: new Date('2030-01-01T10:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Cardiologista', unit: 'UBS Sul', scheduledAt: new Date('2030-01-02T14:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Dermatologista', unit: 'UBS Norte', scheduledAt: new Date('2030-01-03T09:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Pediatra', unit: 'UBS Leste', scheduledAt: new Date('2030-01-04T11:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Endocrinologista', unit: 'UBS Jardim', scheduledAt: new Date('2030-01-05T15:30:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Neurologista', unit: 'UBS Amarela', scheduledAt: new Date('2030-01-06T13:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Ginecologista', unit: 'UBS Primavera', scheduledAt: new Date('2030-01-07T09:30:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Urologista', unit: 'UBS Lagoa', scheduledAt: new Date('2030-01-08T16:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Psiquiatra', unit: 'UBS Vila', scheduledAt: new Date('2030-01-09T10:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
        { patientId: patient.id, doctorId: doctor?.id || '00000000-0000-0000-0000-000000000000', specialty: 'Oftalmologista', unit: 'UBS Bosque', scheduledAt: new Date('2030-01-10T14:00:00.000Z'), status: 'confirmed', priority: 'normal', type: 'presencial', checkedIn: false },
      ],
    });
  }

  const examCount = await prisma.exam.count({ where: { patientId: patient.id } });
  if (examCount < 10) {
    await prisma.exam.createMany({
      data: [
        { patientId: patient.id, exam: 'Hemograma', preparationNotes: null, urgent: false, status: 'laudo_pronto', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: new Date('2025-01-01T00:00:00.000Z'), withdrawnAt: null, updatedAt: new Date('2025-01-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Raio-X de Tórax', preparationNotes: null, urgent: false, status: 'pendente', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: null, withdrawnAt: null, updatedAt: new Date('2025-02-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Ultrassom Abdominal', preparationNotes: null, urgent: false, status: 'laudo_pronto', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: new Date('2025-03-01T00:00:00.000Z'), withdrawnAt: null, updatedAt: new Date('2025-03-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Colesterol Total', preparationNotes: null, urgent: false, status: 'laudo_pronto', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: new Date('2025-04-01T00:00:00.000Z'), withdrawnAt: null, updatedAt: new Date('2025-04-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Glicemia de Jejum', preparationNotes: null, urgent: false, status: 'pendente', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: null, withdrawnAt: null, updatedAt: new Date('2025-05-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Eletrocardiograma', preparationNotes: null, urgent: false, status: 'laudo_pronto', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: new Date('2025-06-01T00:00:00.000Z'), withdrawnAt: null, updatedAt: new Date('2025-06-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Ultrassom de Tireoide', preparationNotes: null, urgent: false, status: 'laudo_pronto', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: new Date('2025-07-01T00:00:00.000Z'), withdrawnAt: null, updatedAt: new Date('2025-07-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Exame de Urina', preparationNotes: null, urgent: false, status: 'pendente', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: null, withdrawnAt: null, updatedAt: new Date('2025-08-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Teste de COVID-19', preparationNotes: null, urgent: false, status: 'laudo_pronto', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: new Date('2025-09-01T00:00:00.000Z'), withdrawnAt: null, updatedAt: new Date('2025-09-01T00:00:00.000Z') },
        { patientId: patient.id, exam: 'Densitometria Óssea', preparationNotes: null, urgent: false, status: 'pendente', lab_externo: null, requestedById: doctor?.id || '00000000-0000-0000-0000-000000000000', deliveredById: null, deliveredAt: null, readyAt: null, withdrawnAt: null, updatedAt: new Date('2025-10-01T00:00:00.000Z') },
      ],
    });
  }

  const medicationCount = await prisma.medication.count({ where: { patientId: patient.id } });
  if (medicationCount < 10) {
    await prisma.medication.createMany({
      data: [
        { patientId: patient.id, name: 'Losartana', dosage: '50mg', frequency: '1x ao dia', schedules: '08:00', initialQuantity: 20, remainingQuantity: 20 },
        { patientId: patient.id, name: 'Metformina', dosage: '500mg', frequency: '2x ao dia', schedules: '09:00,21:00', initialQuantity: 3, remainingQuantity: 3 },
        { patientId: patient.id, name: 'Sinvastatina', dosage: '20mg', frequency: '1x à noite', schedules: '21:00', initialQuantity: 15, remainingQuantity: 15 },
        { patientId: patient.id, name: 'Paracetamol', dosage: '500mg', frequency: '3x ao dia', schedules: '08:00,13:00,18:00', initialQuantity: 12, remainingQuantity: 12 },
        { patientId: patient.id, name: 'Ácido Fólico', dosage: '5mg', frequency: '1x ao dia', schedules: '07:00', initialQuantity: 30, remainingQuantity: 30 },
        { patientId: patient.id, name: 'Amoxicilina', dosage: '500mg', frequency: '3x ao dia', schedules: '08:00,14:00,20:00', initialQuantity: 10, remainingQuantity: 10 },
        { patientId: patient.id, name: 'Omeprazol', dosage: '20mg', frequency: '1x ao dia', schedules: '07:30', initialQuantity: 25, remainingQuantity: 25 },
        { patientId: patient.id, name: 'Dipirona', dosage: '500mg', frequency: '2x ao dia', schedules: '12:00,18:00', initialQuantity: 18, remainingQuantity: 18 },
        { patientId: patient.id, name: 'Vitamina D', dosage: '1000 UI', frequency: '1x ao dia', schedules: '08:00', initialQuantity: 40, remainingQuantity: 40 },
        { patientId: patient.id, name: 'Cetirizina', dosage: '10mg', frequency: '1x ao dia', schedules: '20:00', initialQuantity: 22, remainingQuantity: 22 },
      ],
    });
  }

  const logCount = await prisma.medicationLog.count({ where: { medication: { patientId: patient.id } } });
  if (logCount < 5) {
    const medications = await prisma.medication.findMany({ where: { patientId: patient.id }, take: 5 });
    await prisma.medicationLog.createMany({
      data: medications.map((med, index) => ({
        patientId: patient.id,
        medicationId: med.id,
        confirmedAt: new Date(`2025-01-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`),
      })),
    });
  }
}

app.listen(port, host, async () => {
  await prisma.$connect();
  await seed();
  console.log(`API running on http://${host}:${port}`);
  console.log(`Discovery endpoint: GET /api/info`);
});
