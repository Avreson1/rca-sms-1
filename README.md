# Royal Crown Academy — Virtual Classroom System (RCA VCS)

School management portal for Royal Crown Academy (Rayfield, Jos). Covers staff and student
enrolment, the 4-tier RBAC model, per-section grading scales (Pre-Play → SSS), CBT exams,
CA gradebooks, result publication, and bursary invoicing.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Postgres) for persistence; the UI falls back to seeded local demo data when
  Supabase is not configured
- Server-side login with a signed, HttpOnly session cookie (`src/proxy.ts` guards every route)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000 — you will be redirected to `/login`.

### Local development accounts

When `NODE_ENV` is not `production` and no `AUTH_*` variables are set, these development
accounts are active:

| Role | Username | Password |
| --- | --- | --- |
| Super Admin | `dominic370` | `admin123` |
| Exam Officer | `exam_officer` | `exam123` |
| Teacher | `teacher_grace` | `teach123` |
| Accountant | `bursar_accounts` | `bursar123` |
| Student / Parent | `parent_rca` | `parent123` |

In production the development accounts are disabled — credentials must be supplied through
`AUTH_SUPER_ADMIN_USERNAME` / `AUTH_SUPER_ADMIN_PASSWORD` (and the other `AUTH_*` variables).

## Environment variables

See [.env.example](.env.example). The essentials:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by `/api/*` routes — never expose it |
| `AUTH_SESSION_SECRET` | Signs the login cookie; required in production |
| `AUTH_SUPER_ADMIN_USERNAME` / `AUTH_SUPER_ADMIN_PASSWORD` | Administrator login |

## Database

The schema and seed data live in [`supabase/schema.sql`](supabase/schema.sql) and
[`supabase/seed.sql`](supabase/seed.sql). Run them once in the Supabase SQL editor.

## Deployment

`render.yaml` defines a Render web service (`npm install && npm run build`, start with
`npm run start`). Set the environment variables in the Render dashboard, then deploy.

## Documentation

- [DOCUMENTATION.md](DOCUMENTATION.md) — roles, class hierarchy, grading tiers, module walkthrough
- [DEPLOYMENT.md](DEPLOYMENT.md) — Supabase + Render deployment steps
- [TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md](TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md) — QA onboarding
