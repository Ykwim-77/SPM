const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const fetch = global.fetch;

dotenv.config({ path: path.resolve(__dirname, '.env') });

const secret = process.env.JWT_SECRET_STAFF || process.env.JWT_SECRET || 'dev-staff-secret';
const doctorId = '011a2ef9-e57e-462c-ac93-9ccd1d19cdd1';
const token = jwt.sign({ sub: doctorId, email: 'medico@spm.gov.br', role: 'medico' }, secret, { expiresIn: '8h' });

(async () => {
  const payload = {
    patient_id: '0d375193-09c8-4353-aa0a-23e980252756',
    medication: 'Ibuprofeno',
    active_substance: 'Ibuprofeno',
    dosage: '200 mg',
    frequency: '2x ao dia',
    duration_days: 10,
    route: 'Oral',
    schedule: ['08:00','20:00'],
    initial_quantity: 20
  };

  try {
    const res = await fetch('http://127.0.0.1:8001/api/prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log('status', res.status);
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); } catch { console.log(text); }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
