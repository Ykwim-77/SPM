# PRD - Saúde na Palma da Mão (Patient App)

## Overview
Mobile-first patient companion app (Expo React Native + FastAPI + MongoDB) inspired by the "Saúde na Palma da Mão" SUS project. Only the patient role is implemented.

## Design
- Palette: Blue (#0066CC) primary + Green (#00A650) secondary. Soft neutrals.
- Layout: extremely intuitive, big touch targets (≥ 44pt), rounded cards, generous spacing.
- Bottom tab navigation: Início, Consultas, Remédios, Perfil.

## Features (v1 MVP)
1. Auth (JWT + email/password) — register, login, logout, protected `/me`.
2. Home Dashboard — greets user, shows next appointment, quick tiles for Consultas/Remédios/Exames/Emergência, stats.
3. Appointments — list (upcoming/history segmented), detail, cancel, 3-step booking (Especialidade → Profissional → Data/Hora).
4. Medications — list with stock progress + low-stock warning, detail with history, add new, delete, take-dose flow with camera capture (anti-fraud) + skip option.
5. Exams & Documents — list, detail with status badge.
6. Emergency Card — glanceable colored card with blood type, allergies, emergency contact.
7. Profile — view/edit personal data + emergency info + logout.

## Backend Endpoints (all under `/api`)
- Auth: `POST /auth/register`, `POST /auth/login`, `GET/PUT /auth/me`
- Dashboard: `GET /dashboard`
- Appointments: `GET /appointments`, `GET /appointments/{id}`, `POST /appointments`, `POST /appointments/{id}/cancel`
- Medications: `GET /medications`, `GET /medications/{id}`, `POST /medications`, `DELETE /medications/{id}`, `POST /medications/take`, `GET /medications/{id}/logs`
- Exams: `GET /exams`, `GET /exams/{id}`

## Data Seeding
On backend startup a demo user is created with 3 appointments (confirmed / waitlist / completed), 3 medications (Losartana, Metformina low-stock, Sinvastatina), and 3 exams. New users registered via API also get their own seed data.

## Notes
- Photo anti-fraud: `POST /medications/take` accepts optional `photo_base64`; MVP stores locally, no AI analysis.
- Camera captured in JPEG base64 (0.4 quality) to keep payload small.
- Web preview falls back to "skip photo" since camera is unreliable in web bundle.
