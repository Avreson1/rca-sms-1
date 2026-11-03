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

Inside that, each data route also checks the role:

| Route | Read | Write |
| --- | --- | --- |
| `/api/staff` | Super admin, exam officer, QA tester | Super admin |
| `/api/students` | Super admin, exam officer, teacher, bursar, QA tester | Super admin, exam officer |
| `/api/invoices` | Super admin, bursar, QA tester | Super admin, bursar |
| `/api/ca` | — | Super admin, exam officer, teacher |
| `/api/accounts` | Super admin | Super admin |
| `/api/presence` | any signed-in role | any signed-in role |

### `POST /api/ca` — the CA write path

Super admin, exam officer, or teacher signs in and sends one student's scores:

```json
{
  "admissionNo": "RCA/2025/001",
  "session": "2025/2026",
  "term": "First Term",
  "scores": [
    { "subject": "Mathematics", "test1": 8, "test2": 7, "project": 9,
      "midTerm": 6, "exam": 45, "grade": "B2", "remark": "Very good" }
  ]
}
```

The student is looked up by admission number (404 if unknown), the component limits from the
schema's CHECK constraints are enforced before anything reaches Supabase (`0–10` for
`test1`/`test2`/`project`/`midTerm`, `0–60` for `exam`), a repeated subject in one submission is
rejected, and `total_score` is never sent because the database computes it. Rows are upserted on
`(student_id, subject, session, term)`, so re-submitting a subject updates it instead of
duplicating it. `grade` is required from the caller: the schema would otherwise file the row
under its `DEFAULT 'F'`, which would book a failed grade against a child who was never graded.

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

- **Students, staff and invoices do go through the routes; CA does not.**
  `src/lib/realtime-store.ts` calls `GET /api/students`, `GET /api/staff` and `GET /api/invoices`
  when the dashboard mounts, and posts new students and staff to `POST /api/students` /
  `POST /api/staff`. Only `/api/ca` has no caller yet, so grades entered in *Update CA* stay in
  the browser's own storage until that screen posts to it. Every route checks the signed-in role
  through `requireRole()` (`src/lib/auth/guard.ts`).
- **A refused fetch or write is invisible on screen.** `requestJson()` turns any non-2xx response
  into `null`, and the store then keeps its local copy; `insertStudentToSupabase()` and
  `insertStaffToSupabase()` ignore the result entirely. So when the role gates answer 403 — a
  teacher opening the staff list, a parent opening the roll — the screen shows whatever that
  browser already had, or an empty list on a fresh device (the initial seeds in
  `realtime-store.ts` are intentionally empty), and looks like it worked. Surfacing those
  failures is the next change.
- **Most mutations are still browser-only.** Recording a fee payment (`recordPayment`),
  editing a student, saving scores and deleting a student write to `localStorage` and nothing
  else — only adding a student and adding staff reach the database. A payment entered on the
  bursar's laptop does not exist for anyone else and disappears if that browser's storage is
  cleared. The server-side routes for these exist (`/api/invoices`, `/api/ca`); the store does
  not call them yet.
- **A parent cannot fetch their own child's records from those routes.** `/api/students` and
  `/api/invoices` return the whole school, so `STUDENT_PARENT` is deliberately excluded until
  they filter by admission number. Parents still see their child's results through the pages
  they can reach.
- **Grading maths still runs in the browser.** `/api/ca` records the `grade` the caller sends
  instead of deriving it from `total_score`, so a crafted request can file any letter grade under
  a passing or failing total. Server-side grading is the next change.
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
