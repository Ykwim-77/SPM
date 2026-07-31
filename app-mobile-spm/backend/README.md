# Backend Saude na Palma

## Como rodar

```bash
cd backend
npm install
npm start
```

## Banco

Este projeto usa SQLite via Prisma. O banco compartilhado fica em:

- ../shared/saude.db

O backend mobile carrega o caminho do banco em `app-mobile-spm/backend/.env` via `DATABASE_URL`.

## Variáveis de ambiente

O arquivo .env já está configurado para uso local:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret-123"
PORT=8000
EXPO_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
```

## Endpoints principais

- GET /api/
- POST /api/auth/login
- POST /api/auth/register
- GET /api/dashboard
- GET /api/appointments
- GET /api/exams
