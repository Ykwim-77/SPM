import test from 'node:test';
import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:8000';

test('health route returns ok', async () => {
  const res = await fetch(`${base}/api/`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.message, /Saúde/);
});

test('registration creates a patient and allows login', async () => {
  const suffix = Date.now();
  const payload = {
    email: `mobile-reg-${suffix}@example.com`,
    password: 'senha123',
    name: 'Paciente Registro',
    cpf: `123456789${String(suffix).slice(-2)}`,
    birthDate: '1990-01-01',
    phone: '11999999999',
    address: 'Rua Teste',
    gender: 'M',
  };

  const registerRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(registerRes.status, 200);
  const registerBody = await registerRes.json();
  assert.ok(registerBody.access_token);

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  });
  assert.equal(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.ok(loginBody.access_token);
});

test('login works for demo user', async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@saudepalma.com.br', password: 'senha123' }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.access_token);
});

test('dashboard and appointments routes work for authenticated user', async () => {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@saudepalma.com.br', password: 'senha123' }),
  });
  const loginBody = await login.json();
  const token = loginBody.access_token;

  const dashboard = await fetch(`${base}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(dashboard.status, 200);
  const dashboardBody = await dashboard.json();
  assert.ok(dashboardBody.next_appointment || dashboardBody.upcoming_count >= 0);

  const appointments = await fetch(`${base}/api/appointments`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(appointments.status, 200);
  const appointmentsBody = await appointments.json();
  assert.ok(Array.isArray(appointmentsBody));
});

test('medications routes work for authenticated user', async () => {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@saudepalma.com.br', password: 'senha123' }),
  });
  const loginBody = await login.json();
  const token = loginBody.access_token;

  const medications = await fetch(`${base}/api/medications`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(medications.status, 200);
  const medicationsBody = await medications.json();
  assert.ok(Array.isArray(medicationsBody));
});

test('notifications route works for authenticated user', async () => {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@saudepalma.com.br', password: 'senha123' }),
  });
  const loginBody = await login.json();
  const token = loginBody.access_token;

  const notifications = await fetch(`${base}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(notifications.status, 200);
  const notificationsBody = await notifications.json();
  assert.ok(Array.isArray(notificationsBody));
});
