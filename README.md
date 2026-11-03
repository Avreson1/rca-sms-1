# Royal Crown Academy — Virtual Classroom System (RCA VCS)

School management portal for Royal Crown Academy (Rayfield, Jos). Covers staff and student
enrolment, role-based access, per-section grading scales (Pre-Play → SSS), CBT exams,
CA gradebooks, result publication, and bursary invoicing. The portal is usable on phones,
tablets and laptops, and the public-facing pages (`/welcome`, `/blog`, `/gallery`) work
without signing in.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Postgres) for persistence; the UI falls back to seeded local demo data when
  Supabase is not configured
- Server-side login with a signed, HttpOnly session cookie, enforced by `src/proxy.ts`
  on every non-public route

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000 — you will be redirected to `/login`.

## Logging in

Credentials are checked in this order, and the first match wins:

1. **Environment accounts** (`AUTH_<ROLE>_USERNAME` / `_PASSWORD`) — the bootstrap route in.
   Because these live outside the database, a missing table or a Supabase outage can never
   lock the administrator out.
2. **Development accounts** — active whenever `NODE_ENV` is not `production`, alongside any
   environment accounts:

   | Role | Username | Password |
   | --- | --- | --- |
   | Super Admin | `dominic370` | `admin123` |
   | Exam Officer | `exam_officer` | `exam123` |
   | Teacher | `teacher_grace` | `teach123` |
   | Accountant | `bursar_accounts` | `bursar123` |
   | Student / Parent | `parent_rca` | `parent123` |

3. **App-managed accounts** — real people created from Settings → User Access, stored in the
   `app_accounts` table. This is how you add the third teacher, or a QA tester, without
   editing server variables and redeploying.

If no `AUTH_SESSION_SECRET` is configured, login fails with a clear message rather than
issuing an unsigned cookie.

## Managing people from the app

Settings → **User Access** (super admin only). For each account you can:

- **Create Login** — pick the role, optional username (auto-generated from the name if left
  blank), staff/admission ID and email. The password is generated for you and shown **once**;
  copy it before closing the panel. Only a salted scrypt hash is stored, never the password.
- **New Password** — issues a replacement and signs out every device already using that account.
- **Suspend / Restore** — a suspended account cannot sign in, and an existing session stops
  working on its next request.
- **Delete** — removes the row outright.

Revocation works because the signed cookie carries the account's `token_epoch`. Suspending,
restoring or resetting advances that counter in the database, so a cookie issued before the
change is refused even though it is still within its 8-hour lifetime. Environment accounts
carry no epoch and are therefore not revocable from the app — they exist to keep the door open.

Guard rails: you cannot suspend, reset or delete the account you are signed in with, and only
a super admin can reach this screen or its API.

## Environment variables

See [.env.example](.env.example). The essentials:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by `/api/*` routes — never expose it |
| `AUTH_SESSION_SECRET` | Signs the login cookie; required in production |
| `AUTH_SUPER_ADMIN_USERNAME` / `AUTH_SUPER_ADMIN_PASSWORD` | Bootstrap administrator |
| `AUTH_EXAM_OFFICER_*`, `AUTH_TEACHER_*`, `AUTH_ACCOUNTANT_*`, `AUTH_STUDENT_PARENT_*` | Optional environment accounts; `_NAME`, `_STAFF_ID`, `_EMAIL` suffixes are read too |

## Database setup

Run these in the Supabase SQL editor, in order:

1. [`supabase/schema.sql`](supabase/schema.sql) — tables and reference data
2. [`supabase/seed.sql`](supabase/seed.sql) — demo seed data
3. [`supabase/app_accounts.sql`](supabase/app_accounts.sql) — the `app_accounts` login table.
   Idempotent: re-running it after an upgrade adds only the missing columns. Until you run
   this, app-managed logins cannot be created and User Access reports *Database not configured*.
4. [`supabase/harden-rls.sql`](supabase/harden-rls.sql) — drops the old permissive public
   policies and enables RLS on the student, staff and finance tables

`app_accounts` deliberately has RLS enabled with **no** policies, so only the server (holding
the service-role key) can read it. The browser's anon key sees nothing, including the hashes.

## Public and protected routes

`src/proxy.ts` lets `/welcome`, `/blog`, `/gallery` and `/login` through without a session.
Everything else — including every `/api/*` route — requires a valid signed cookie, and
app-managed sessions are additionally re-checked against their database row (see revocation
above).

## Deployment

`render.yaml` describes a Render web service; the [`Dockerfile`](Dockerfile) is the plain
Docker path (multi-stage, `npm run build` then `npm run start`). Set the environment variables
in the Render dashboard, then deploy.

## Repository layout

The deployable app is the **repository root** (`src/`, `Dockerfile`, `package.json`). The
`rca-sms/` folder is a separate, un-deployed copy of the portal with its own configuration and
a different auth design; it is excluded from this project's TypeScript and ESLint scope so it
cannot break the build. Nothing in `rca-sms/` reaches production.

## Current limitations

Be aware of what this system does **not** do today:

- **`/api/*` routes check that you are signed in, not what role you are.** A logged-in
  student or parent can call `/api/staff` or `/api/students` directly and receive the data,
  even though the UI will not show them those pages. Closing this means adding a role check
  inside each route handler — see `isActionAuthorized()` in `src/lib/rbac.ts` for the matrix
  it should follow.
- **No password reset by email.** Only a super admin can set a password, by generating a new
  one from User Access. Self-service reset needs Supabase Auth (`auth.users`), which is the
  deliberate next step.
- **No email or SMS sending** — staff activation and notifications are manual.
- **No online payments** — invoices are tracked, not paid through the portal.
- **"Realtime" sync is per-browser** (`BroadcastChannel`), not server push across users.
- **No AI proctoring or long-term audit store** for CBT exams.

## Documentation

- [DOCUMENTATION.md](DOCUMENTATION.md) — roles, class hierarchy, grading tiers, module walkthrough
- [DEPLOYMENT.md](DEPLOYMENT.md) — Supabase + Render deployment steps
- [TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md](TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md) — QA onboarding
