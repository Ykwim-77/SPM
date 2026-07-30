const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env') });
const secret = process.env.JWT_SECRET_STAFF || process.env.JWT_SECRET || 'dev-staff-secret';
const token = jwt.sign({ sub: '011a2ef9-e57e-462c-ac93-9ccd1d19cdd1', email: 'medico@spm.gov.br', role: 'medico' }, secret, { expiresIn: '8h' });
console.log(token);
