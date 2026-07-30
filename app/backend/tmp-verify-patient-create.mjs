import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:8001';

try {
  const atendente = await prisma.user.findFirst({ where: { role: 'atendente' }, select: { email: true, name: true } });
  console.log('Atendente found', atendente);

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: atendente.email, password: 'senha123' }),
  });
  const loginBody = await loginRes.json();
  console.log('Login status', loginRes.status, JSON.stringify(loginBody));

  const token = loginBody.token;
  const unique = Date.now();
  const patientEmail = `patient+${unique}@example.com`;
  const createRes = await fetch(`${base}/api/patients`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Paciente QA Validacao',
      cpf: `${unique}`.slice(-11),
      email: patientEmail,
      temporary_password: 'TempSenha123!',
      birth_date: '1992-02-02',
      phone: '(11) 99999-0000',
      address: 'Rua QA 100',
      lgpd_accepted: true,
    }),
  });

  const createBody = await createRes.text();
  console.log('Create status', createRes.status, createBody);
} finally {
  await prisma.$disconnect();
}
