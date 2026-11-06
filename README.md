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

## Before go-live — read this first

**This repository is the test environment.** Nothing here is the live school system yet.
The plan is to make every flow provably correct on this instance, then clone the repository
and stand up a separate live project. The four items below are blockers on that clone, not
optional polish, and they are the reason a green screen in the browser is not yet proof of
anything.

### 1. Nightly database backup — blocked until five secrets exist

A free Supabase project has **no backups of any kind**. Until `.github/workflows/nightly-backup.yml`
runs green, the school's entire record history exists in exactly one place. It is written and it
fails loudly on purpose until someone adds, in GitHub → *Settings → Secrets and variables → Actions*:

| Secret name | Where it comes from |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection string → **URI**, switched to **Direct connection** (port `5432`, not the `6543` pooler — `pg_dump` needs a session). Set `PGSSLMODE=require`. |
| `R2_ENDPOINT` | Cloudflare → R2 Object Storage → *Manage Bucket Keys* → the endpoint ending in `r2.cloudflarestorage.com` |
| `R2_BUCKET` | the bucket name, e.g. `rca-sms-backups` (10 GB free, no download fees) |
| `R2_ACCESS_KEY_ID` | same R2 key page |
| `R2_SECRET_ACCESS_KEY` | same R2 key page |

A dump is a copy of every child's record. It goes to the bucket only — never committed to this
repository, never uploaded as a workflow artifact, never into a repository that could later be
made public. Retention is 15 daily copies plus one copy per month kept a year.

**A backup you have not restored is a rumour.** Restore drill, and repeat it after any clone:

```bash
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
rclone copy "backup:$R2_BUCKET/daily/" ./restored --include "rca-*.dump"
pg_restore --list ./restored/rca-<stamp>.dump | head        # proves the archive opens
pg_restore --clean --if-exists --no-owner -d "$SUPABASE_DB_URL" ./restored/rca-<stamp>.dump
```

Do this against a *spare* project first. Pointing `--clean` at the live database restores over it.

### 2. The five-minute pinger — still undecided

`.github/workflows/keep-warm.yml` visits `/api/keep-warm` every six hours, and that route asks the
database one question that returns no records. Six hours is plenty to stop Supabase pausing after
seven quiet days, but it is **not** enough to stop Render spinning a free web service down after
fifteen idle minutes: the first teacher of the morning still waits about a minute for a cold start.

Pick one before the term opens, because it is a decision about money and about who gets paged:

- a free uptime pinger (cron-job.org, UptimeRobot) at a **4–5 minute** interval against
  `https://rca-sms-1.onrender.com/api/keep-warm` — no cost, no cold starts, depends on a third party;
- Render **Starter** at roughly $7 a month — no sleeping, no third party, no cold start;
- nothing, and everyone accepts a slow first page each school morning.

`/api/keep-warm` is public by design and answers only `reachable` / `unreachable`: the probe is a
count with no rows and the number is never sent back, so the URL cannot be used to learn how many
pupils or staff the school has.

### 3. Branch protection — one click, and it is the one that matters most

`main` deploys itself the moment it is pushed to, and more than one agent has been given write
access to this repository. GitHub → `Avreson1/rca-sms-1` → *Settings → Branches → Add branch
protection rule*: branch name pattern `main`, then tick **Require a pull request before merging**
and **Require status checks to pass** → choose `CI / build`. Until that is set, a broken build can
be live without anyone deciding it should be.

### 4. The portal is multi-machine for the records, the money, the card, the class and subject lists, the exam and the term calendar

A clerk's entry now reaches every other machine for: pupils, staff and logins, the class arms the
school runs, the subject list and the subject packages, invoices, the fee
schedule, payments and receipts, CA and exam marks, the grading scales, the school's own name /
session / term, published results, closed terms, the list of rated traits, what the school owns and
every unit of stock that moved in or out of its stores, the timetable with the number of periods and
breaks a school day actually has, the duty roster with who filed it and against which date, the
milestones the office dates a term by and the activity blueprints they are scheduled from, the
questions the exam office sets and the sittings candidates finish (as attempts, never as marks) and
the switch that shuts the exam portal, and —
once the form teacher presses *File
this class into the school's records* on *Traits & Psychomotor* — the character, psychomotor and
attendance ratings that fill the other half of a child's card. That was the `P0`–`P2` work and it
depends on `supabase/operations_state.sql`, `supabase/traits_assessments.sql`,
`supabase/inventory.sql`, `supabase/timetable.sql`, `supabase/staff_duties.sql`,
`supabase/classes_and_subjects.sql`, `supabase/cbt.sql` and `supabase/calendar.sql` having been run.
Still browser-local: the CA component structure, the report theme and newsletter, and
Inmail — each of those screens carries a *Kept on this browser* notice so nobody mistakes it for a
record (the timetable screen keeps one, because the teacher names it groups by are still only on this
device; the calendar screen shows one only while its two lists cannot be read from the school's
records). See
*Current limitations* and the `P0`–`P4` order in [DEPLOYMENT.md](DEPLOYMENT.md).

### Cloning this repository for the live school

Everything that must change, in the order that avoids surprises:

1. New Supabase project → run every file in *Database setup* below, in that order, including
   `supabase/operations_state.sql`, `supabase/traits_assessments.sql`, `supabase/inventory.sql`,
   `supabase/timetable.sql`, `supabase/staff_duties.sql` and `supabase/calendar.sql`.
   The `GRANT` block at the
   end of each is what lets the server touch the new tables (privileges belong to the
   `service_role`, so a new project needs them again); a clone that skips it shows
   *"permission denied for table school_config"*.
2. New Render service from the cloned repository; set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (the `sb_secret_…` form), a fresh
   `AUTH_SESSION_SECRET`, and the `AUTH_SUPER_ADMIN_*` bootstrap account.
3. New bucket and new `SUPABASE_DB_URL` in the clone's secrets; verify a backup run and a restore.
4. Repo variable `KEEP_WARM_URL` pointing at the new host, or edit the fallback in
   `keep-warm.yml` — that variable is why the workflow survives a clone unedited.
5. Update the hostname in `render.yaml`, this file, and `DEPLOYMENT.md`.
6. Enrol real pupils before inviting staff: the live `students` and `invoices` tables being empty
   is otherwise mistaken for a wiped system.

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

Five wrong passcodes from one address against one username locks that combination for 15
minutes (`429` with a `Retry-After` header), and a successful sign-in clears the count. The
tally lives in the server's memory, so a restart or a second instance resets it — it raises
the cost of a scripted password run, it is not a replacement for a shared store if the portal
ever runs more than one instance.

## Managing people from the app

Staff logins are issued where the person is hired: **Operations → Staff → Register Staff** saves
the staff record and, in the same request, creates their login. The private access slip then shows
the password the server actually generated — it used to print a passcode invented in the browser
with `Math.random()`, which was stored nowhere and signed nobody in. If the login cannot be created
the slip stays closed and an amber notice says why; the staff record is still saved, and the login
can be made here afterwards.

The **Access Slip** button on each row of the staff table does the same job for someone already
registered: `POST /api/accounts/issue` replaces that person's passcode if they have one — signing
out every device holding the old one — or creates the login if they never had one. It refuses an
username that the server's own `AUTH_*` variables answer for, because a portal password issued under
such a name would be stored, printed, and then never consulted at sign-in.

Settings → **User Access** (super admin only) keeps everything else. For each account you can:

- **Create Login** — for pupils' parents, testers and anyone not onboarded through the staff
  register. Pick the role, optional username (auto-generated from the name if left
  blank), staff/admission ID and email. The password is generated for you and shown **once**;
  copy it before closing the panel. Only a salted scrypt hash is stored, never the password.
- **Link children** — when the role is *Student / Parent*, the form also asks for admission
  numbers. Those pairs are written to `guardian_students` and decide what that login may read.
  An existing parent row shows its children; click the numbers to change the whole set (leave it
  empty to unlink every child). Only a Parent login can hold children — the API refuses admission
  numbers for any other role.
- **New Password** — issues a replacement and signs out every device already using that account.
- **Suspend / Restore** — a suspended account cannot sign in, and an existing session stops
  working on its next request.
- **Delete** — removes the row outright, and with it every child linked to that username. Leaving
  the links behind would hand those pupils to whoever takes the username next.

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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase key. The server routes do **not** fall back to it |
| `SUPABASE_SERVICE_ROLE_KEY` | **Required.** Server-only key used by `/api/*` routes — never expose it. Row-level security denies the anon key on every school table, so without this the data routes answer 503 and accounts created in User Access cannot sign in |
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
5. [`supabase/guardian_students.sql`](supabase/guardian_students.sql) — the table that pairs a
   Parent login with its pupils. Until you run it, app-managed logins still sign in and every
   staff screen works, but a parent's data calls fail with *The guardian link table could not be
   read* (or, once the table exists but holds no row for them, *No pupil is linked to this login
   yet*).
6. [`supabase/operations_state.sql`](supabase/operations_state.sql) — **the one that turns the
   office screens from a performance into a record.** It creates `school_config` (the school's own
   name, session and term), `result_publications` (which class arms are released), `closed_terms`
   (what End of Term actually archived) and `fee_components` (the bursar's price list), adds the
   `bank_reference` / `received_by` / `session` / `term` columns a payment receipt needs, and
   grants all of them to `service_role`. Safe to re-run. Until you run it, Settings, Publish
   Results, End of Term, Fee Structure, Invoicing and the Transactions ledger answer
   *This part of the database is not set up on this project yet. Run supabase/operations_state.sql
   in the Supabase SQL editor, then try again.* (`503`) — and everything those three office
   screens used to claim ("Published and authorized results for SS 2!", "successfully archived!
   Next term initialized.") was a browser-local performance with no record behind it.
7. [`supabase/traits_assessments.sql`](supabase/traits_assessments.sql) — the other half of a
   child's card. It creates `traits_config` (the school's list of rated traits, seeded with the
   fourteen the portal ships with) and `traits_assessments` (one row per pupil per session per
   term: affective and psychomotor ratings, days opened and present, the form teacher's remark,
   the Head's endorsement and the resumption date), and grants both to `service_role`. Safe to
   re-run, and it never overwrites a rubric the school has since edited. Until you run it, the
   marks on a score card come from the school's records but the behaviour panel does not: the
   card reads `/api/traits`, gets `503`, and says so on the panel itself instead of printing
   praise nobody typed.
8. [`supabase/inventory.sql`](supabase/inventory.sql) — what the school owns. It creates
   `inventory_items` (the register: label, category, unit, **opening** quantity, location,
   custodian, condition, acquisition date, value paid, reorder level), `inventory_movements`
   (every receipt and issue, with who took it and for what) and the `inventory_stock` view that
   adds the log up into the quantity on hand. The stock figure is never stored, so it cannot
   disagree with the movements that produced it; the only quantity anyone types is the opening
   one, and an issue bigger than the shelf is refused. Safe to re-run. Until you run it,
   *Accounts → Inventory* reports *The stores register could not be read* and `/api/inventory`
   answers the `503` that names this file. The view is revoked from `anon` and `authenticated`
   along with the tables: a plain view runs with its owner's rights, so it would otherwise be the
   one door the browser key could walk through while every other table stays shut.
9. [`supabase/timetable.sql`](supabase/timetable.sql) — the school's timetable. It creates
   `timetable_entries` (one lesson per class, day and period, for one session and term) and
   `timetable_periods` (how many periods that term's day has, where the breaks fall and which
   weekdays are taught), then grants both to `service_role`. Two rules live in the database rather
   than in a screen's hopes: `UNIQUE (session, term, class_name, day, period_index)` means a slot
   holds one lesson, and a `CHECK` means a row cannot be filed under a term the portal does not
   recognise. Whether one teacher is in two classes at once is decided by
   [`src/lib/timetable/clashes.ts`](src/lib/timetable/clashes.ts), imported by the save route, the
   grid and the generator so all three use the same test — two rules is how a double-booking sits
   unnoticed until a class arrives empty. It seeds one day shape (`2026/2027`, First Term, the six
   periods the portal always printed) behind `WHERE NOT EXISTS`, so a re-run never overwrites a day
   the school chose. Until you run it, *Operations → Academics & Timetable* answers *The timetable
   could not be read*, `/api/timetable` returns the `503` that names this file, and **Draft the
   week** cannot place a single lesson because it has no day to place lessons into.
10. [`supabase/staff_duties.sql`](supabase/staff_duties.sql) — what the school says its staff are,
    and who it asks of them each day. It adds `designation` and `standing_duties` to `staff` (both
    `NOT NULL DEFAULT` empty, so every existing row survives the paste and prints as *not stated*
    rather than as a title invented from the person's access tier) and creates `staff_duties`: one
    row is one person, one duty, one named day. Two rules live in the database:
    `UNIQUE (duty_date, staff_id, time_window)` means one person holds one duty per part of a day,
    so re-filing a slot corrects it instead of stacking a second duty on the same morning, and a
    `CHECK` on `time_window` means a duty cannot be filed against a time of day the portal does not
    print. There is **no foreign key** to `staff` on purpose: a duty is a record of what was asked,
    and it has to outlive the staff record it was filed against — the API checks the register
    before filing, which is where "only a real member of staff" is enforced. `assigned_by` stores
    the login that filed the row, taken from the signed session and never from the request. Until
    you run it, *Operations → Duty Roster* and the dashboard *On Duty Today* panel report that the
    roster could not be read, `/api/staff-duty` answers the `503` that names this file, and
    registering a staff member **with** a designation refuses to save with the same sentence (a
    member registered without one still saves, so the portal stays usable before the paste).
11. [`supabase/classes_and_subjects.sql`](supabase/classes_and_subjects.sql) — which arms the school
    runs, what it teaches, and the packages the CA grid offers as a shortcut. It creates `class_arms`
    (one row per arm name; a pupil count is **never** stored on it, it is counted from `students`
    when a screen asks, so no arm can print a number nobody entered), `subjects` (unique per name
    *and* band, because Mathematics in Nursery and Mathematics in SSS 3 are two lines on two
    different grids), and `subject_templates` (a plan, not a register — it holds no pupil figure
    either). Nothing joins a subject to a class or a package's subjects to the subject list, on
    purpose: an arm is retired every year and a report card printed this year has to read the way it
    read on the day it was written, so rows that describe the past quote names while only rows that
    describe the present point at records. Until you run it, *Setup → Classes*, *Setup → Subjects* and
    *Setup → Subject Packages* keep working from the list held on that browser and say so on screen —
    and every screen that groups by arm (CA grid, timetable, fee schedule, promotion, report card)
    is grouping by one machine's cache.
12. [`supabase/cbt.sql`](supabase/cbt.sql) — the exam. It creates `cbt_questions` (the paper: one row
    per question, its options as JSONB with a `CHECK` that there are two to six of them and that the
    right one is among them, and marks the portal can actually use), `cbt_exam_sessions` (one finished
    sitting per row, with the pupil resolved from `students` on the server rather than named by the
    request, and `synced_to_ca` filed `false` — **filing a sitting is not filing a mark**) and
    `cbt_settings` (exactly one row, `id = TRUE` by `CHECK`: the switch that opens or shuts the module
    for candidates, the purpose it is open for, the hours it runs in, the notice a locked screen
    prints, and who moved it last). It also adds the columns `schema.sql` did not give
    `cbt_exam_sessions` on projects that ran the older file, so the same paste works on both. The
    right answer is stored with the question because the browser marks the paper; that is why the
    marked bank and the bank export are limited to the two logins that write it, and a candidate is
    not shown the list at all. Until you run it, `/api/cbt/questions`, `/api/cbt/sessions` and
    `/api/cbt/settings` answer the `503` that names this file, *Settings → CBT Configuration* and the
    sidebar badge work from that browser's copy and label themselves as such, *CBT* refuses to launch
    a paper it cannot read, and the CA grid prints no CBT chip and says the sittings could not be read.
13. [`supabase/calendar.sql`](supabase/calendar.sql) — the term the school plans. It creates
    `school_calendar_events` (one milestone per session, term and title — the unique key is what stops
    a button pressed twice from doubling the calendar) and `activity_templates` (one blueprint per
    title: who the activity is for, who leads it, where, what it costs, how long it runs). **It seeds
    nothing.** The seven milestones *Populate Term Milestones* offers and the six blueprints the portal
    used to ship with ₦450,000 budgets and named coordinators were written by whoever built the
    software, so they now reach the records only when somebody presses the button that calls them a
    starting outline — and every one lands undated. `date_range` is text, never a date column, because
    the school's own wording is a span ("Nov 18 - 20, 2025"); an empty one means *the date has not been
    fixed*, which the screen prints in those words instead of "TBD". A milestone's category widens
    beyond the four the form offers so a scheduled sports day is not filed as "Academic". Filing needs
    the session and term the school says it is in, and a term the portal does not recognise is refused
    by a `CHECK`. Until you run it, `/api/calendar` and `/api/activity-templates` answer the `503` that
    names this file, *Setup → Calendar* says both of its lists are still this browser's copy, and every
    *File…* button on that screen answers *Nothing was filed on the school's records* with this
    sentence.

`app_accounts`, `guardian_students`, both inventory tables, both timetable tables, `staff_duties`,
`class_arms`, `subjects`, `subject_templates`, all three CBT tables and both calendar tables
deliberately have RLS enabled with **no** policies,
so only the server (holding the service-role key) can read them. The browser's anon key sees nothing,
including the hashes.

## Public and protected routes

`src/proxy.ts` lets `/welcome`, `/blog`, `/gallery` and `/login` through without a session.
Everything else — including every `/api/*` route — requires a valid signed cookie, and
app-managed sessions are additionally re-checked against their database row (see revocation
above).

Inside that, each data route also checks the role:

| Route | Read | Write |
| --- | --- | --- |
| `/api/staff` | Super admin, exam officer, QA tester | Super admin |
| `/api/students` | Super admin, exam officer, teacher, bursar, QA tester, parent (**own children only**) | Super admin, exam officer (enrol, and `DELETE` to unenrol) |
| `/api/invoices` | Super admin, bursar, QA tester, parent (**own children only**) | Super admin, bursar (one invoice or a batch) |
| `/api/ca` | — | Super admin, exam officer, teacher |
| `/api/accounts` | Super admin | Super admin |
| `/api/accounts/issue` | — | Super admin (issues or replaces one login by username) |
| `/api/presence` | any signed-in role | any signed-in role |
| `/api/grading-tiers` | super admin, exam officer, teacher, bursar, parent, QA tester | super admin, exam officer |
| `/api/school-config` | every signed-in role | super admin, exam officer |
| `/api/result-publications` | super admin, exam officer, teacher, parent, QA tester (the screens that gate a card on a release row) | super admin, exam officer |
| `/api/term-closings` | every signed-in role | super admin, exam officer (`DELETE` re-opens a term) |
| `/api/fees` | super admin, bursar, QA tester | super admin, bursar |
| `/api/payments` | receipts for one pupil: super admin, bursar, QA tester, parent (**own children only**); the whole ledger: super admin, bursar, QA tester | super admin, bursar |
| `/api/inventory` | super admin, bursar, QA tester | super admin, bursar (`DELETE` refused once the line has a movement) |
| `/api/inventory/movements` | super admin, bursar, QA tester | super admin, bursar (an issue larger than the shelf is refused) |
| `/api/timetable` | super admin, exam officer, teacher, QA tester | super admin, exam officer (a lesson is filed into one empty slot; a teacher already in another class then is refused) |
| `/api/timetable/periods` | super admin, exam officer, teacher, QA tester | super admin, exam officer (a day shape that would strand lessons already filed is refused) |
| `/api/timetable/generate` | super admin, exam officer, teacher, QA tester | nobody — it reads the day and the filed lessons and hands back a proposal; filing it is a separate `PUT /api/timetable`, which only the office can make |
| `/api/staff-duty` | super admin, exam officer, QA tester see the whole school's roster; teacher and bursar see **only the rows filed against their own staff record** | super admin, exam officer (one duty filed against a real, non-suspended staff record, for one date and one part of that day; `DELETE` removes one row by its own id) |
| `/api/classes` | every signed-in role | super admin, exam officer (an arm is filed by its written name; `DELETE` refuses with `409` while pupils are still enrolled in it, naming the arms that hold children) |
| `/api/subjects` | every signed-in role | super admin, exam officer (one row per name *and* band; `DELETE` refuses to remove a subject whose CA marks are still filed and names it) |
| `/api/subject-templates` | every signed-in role | super admin, exam officer (a package with no subjects in it is refused; the pupil count is never stored — it is counted when asked for) |
| `/api/cbt/questions` | every signed-in role (a candidate has to be served the paper the browser marks) | super admin, exam officer (one question or a batch of up to 200; an option list of 2–6 whose right index is inside it, marks 1–100, and only a numeric id is ever removed) |
| `/api/cbt/sessions` | super admin, exam officer, teacher, QA tester, parent (**own children only**); `class_name` / `admission_no` / `session` / `term` filter it, newest first | the same four minus the QA tester — the candidate login files its own sitting, and the office may file one for a supervised room. The pupil, their name and their class come from `students`, never the request; a score above the paper's marks is refused; `synced_to_ca` is always filed `false`. `DELETE`: super admin, exam officer only |
| `/api/cbt/settings` | every signed-in role, **including a candidate** — the locked screen has to read the switch and the notice it prints | super admin, exam officer (opening without naming what the module is used for, or without the hours it runs in, is refused; `updated_by` is the login that moved it) |
| `/api/calendar` | super admin, exam officer, QA tester (`session` and `term` narrow it; the screen's two roles are the only ones the sidebar lets near it) | super admin, exam officer (one milestone or a batch of up to 100; the term must be one the portal knows and the session must come with it, a blank date stays blank, and a title already filed in that session and term is refused with `409` instead of overwriting it. `PATCH` moves one row's status and nothing else; `DELETE` takes only uuid ids) |
| `/api/activity-templates` | super admin, exam officer, QA tester | super admin, exam officer (every field but the title may be blank and stays blank, `duration_days` 1–30; a blueprint with a title already on the list is refused rather than written over) |

`/api/payments` POST is the money path. The receipt is filed first and the invoice balance moved
second; if the balance cannot be moved, the receipt that was just written is withdrawn and the
screen says the payment was not recorded — so the school is never left with a paper payment against
an unchanged debt, nor a reduced debt with no receipt behind it. `ref` (`RCA-PAY-XXXXXXXX`) and
`received_by` (the username on the signed cookie, never the request body) are made by the server,
and a payment larger than the outstanding balance is refused with the amount still owed in the
message, so a fat-fingered amount cannot quietly turn a family's bill into a credit.

`POST /api/staff` does two things in one request: it saves the staff row and asks
`createAppAccount` for that person's login, returning the generated password in the same response
so the access slip can show it once. A failed login never rolls the staff record back — the route
answers `success: true` with `login: null` and a plain-language `loginError`, which the page
displays instead of opening the slip.

**What a parent may read.** `/api/students` and `/api/invoices` take the username from the signed
cookie, look it up in `guardian_students` (`guardianScope` in `src/lib/auth/guardian-links.ts`) and
add `admission_no IN (their children)` to the query — the row filter is never taken from the
browser. A parent with no row linked gets a `403` that says so instead of an unexplained empty
table, and a staff role is untouched by the lookup. Admission numbers are matched against the
`students` table before a link is saved and stored with the spelling the database has, because the
read filter is case-sensitive while the office types whatever case it likes.

**A shared laptop does not pass the last person's data on.** Every screen paints itself from this
browser's own copy before the server has answered, so a Parent login opened on a staff laptop would
show the roster the member of staff left there for a second or two. When a sign-in belongs to a
different username than the one that last held the browser, `handOverBrowser`
(`src/lib/realtime-store.ts`) empties the cached pupils, invoices, subject scores, psychomotor and
traits records and tells the open tabs to repaint. It fires on sign-in, not on signing out: if the
server cannot reach the database, that browser's copy is the only copy there is, so a logged-out
browser keeps it. The owner marker lives beside the data, not in the session, which is why the wipe
still happens after the previous person signed out properly.

The screens use them: enrolling one pupil or a CSV class list, unenroling a pupil, recording a fee
payment, generating invoices, and saving CA scores all post to the server. `POST /api/invoices`
takes one invoice or an array, resolves `student_id` from the admission number on the server
(404 if the pupil is not enrolled — the browser's own `inv-…` ids are never trusted) and upserts on
`invoice_no`; a number already filed for a different pupil is rejected with 409 rather than
rewriting that family's balance. `DELETE /api/students` removes the pupil and, through the
schema's `ON DELETE CASCADE`, their CA scores and invoices — which is why the confirmation on
Students Management says so.

`/api/presence` is the exception: it carries no school data, only who is signed in. The heartbeat
widget posts an empty body and the server takes the name, role and staff ID from the signed cookie,
because the body used to be able to claim any of them. The list lives in the server's memory and
drops anyone who has not beat in 10 minutes, so a restart empties it and each dashboard refills it
within one 5-second sync.

### `POST /api/ca` — the CA write path

Super admin, exam officer, or teacher signs in and sends one student's scores:

```json
{
  "admissionNo": "RCA/2025/001",
  "session": "2025/2026",
  "term": "First Term",
  "scores": [
    { "subject": "Mathematics", "test1": 8, "test2": 7, "project": 9,
      "midTerm": 6, "exam": 45 }
  ]
}
```

The student is looked up by admission number (404 if unknown), the component limits from the
schema's CHECK constraints are enforced before anything reaches Supabase (`0–10` for
`test1`/`test2`/`project`/`midTerm`, `0–60` for `exam`), a repeated subject in one submission is
rejected, and `total_score` is never sent because the database computes it. Rows are upserted on
`(student_id, subject, session, term)`, so re-submitting a subject updates it instead of
duplicating it.

**The grade is decided by the server, not the caller.** `tier_grade` and `remark` are worked out
from the total against the grading scale whose `applicable_classes` covers that pupil's class in
`grading_tiers`. A `grade` or `remark` in the request body is ignored, because a stale tab, a
different scale or a tampered body must not be able to file an `A1` against 32/100 — that letter is
what prints on the paper card the family collects. If the class has no scale on file, or the total
falls outside every bracket, the whole submission is refused with the reason and nothing is saved;
the schema's `DEFAULT 'F'` is never reached, so a child is never booked a failed grade for a mark
that was not filed.

*Update CA* is the caller. It sends one request per pupil for the subject chosen on screen, under
the session and term in `SCHOOL_INFO`, and skips rows that are still all zero — an untouched pupil
is not a score of nought for that subject.

### What the screen says when a call is refused

`src/lib/sync-status.ts` holds the last reported outcome and `SyncStatusNotice`
(`src/components/layout/sync-status-notice.tsx`, mounted by `DashboardShell`) renders it in the
bottom-right corner. A failure stays until it is dismissed; a success hides itself after five
seconds. Reads say what could not be loaded and that the device's own copy is being shown; writes
say the record was **not** saved and why — `403` (role), `401` (signed out), `503`/`502`
(database) — with the route's own message in front of it.

## Deployment

`render.yaml` describes the Render web service that is actually running: `runtime: node`,
`autoDeploy: true`, and its own `buildCommand`/`startCommand` — so Render builds with
`npm install && npm run build`, **not** the Dockerfile. (`npm ci` in the Dockerfile is the pinned,
reproducible path; use one or the other, not both.) The service is named `rca-sms` in
`render.yaml`, but Render assigned it the hostname **`https://rca-sms-1.onrender.com`** — the
`rca-sms.onrender.com` in older docs has no server behind it. Set the environment variables in the
Render dashboard, then deploy.

## Repository layout

The deployable app is the **repository root** (`src/`, `Dockerfile`, `package.json`). The
`rca-sms/` folder is a separate, un-deployed copy of the portal with its own configuration and
a different auth design; it is excluded from this project's TypeScript and ESLint scope so it
cannot break the build. Nothing in `rca-sms/` reaches production.

## Current limitations

Be aware of what this system does **not** do today:

- **Three screens still keep their work in the browser.** Each one now says so on screen, with a
  *Kept on this browser* notice: Inmail, the CA component structure, and the
  report-card theme with the terminal newsletter. None of them has a route behind it, so a second
  machine cannot see the typing and the data is lost if the device is cleared. (*Academics* keeps a
  notice of its own: the lessons are on the school's records and so are the arms they are grouped
  by, but the teacher names the grid reads come from this device's staff list. *Setup → Calendar*
  shows its notice only while the two lists cannot be read from `school_calendar_events` and
  `activity_templates`, i.e. until `supabase/calendar.sql` has been run.) What *is*
  multi-machine: pupils, staff, logins, invoices, fee payments and receipts, CA/exam marks and
  grades, the grading scales, the fee schedule, the school's own name / session / term, published
  results, closed terms, the trait rubric, the stores register and its movement log, the timetable
  and its day shape, the class arms, the subject list and the subject packages, the milestones the
  office dates a term by and the activity blueprints they are scheduled from, the questions the
  exam office sets, the sittings candidates finish, the switch that shuts the exam portal, and the
  character assessments once they are filed. A finished sitting is filed as an **attempt**
  (`synced_to_ca` is always written `false`): the mark itself still only reaches the database when a
  person types it on *Update CA* and saves.
- **Ratings stay on the form teacher's machine until they are filed.** *Traits & Psychomotor*
  edits this device's copy as the adult types — that is what makes a long rating session survive a
  crashed tab — and the screen now says so on the toast (*Not yet in the school's records*). The
  button beside it, *File this class into the school's records*, posts one `/api/traits` request
  per pupil and reports how many landed. A record with no rating, no attendance figure and no
  remark is skipped rather than filed, because an all-blank row would print a panel of *not rated*
  under a child's name and make the card look assessed when nobody looked at them. Until the file
  is run, the ratings go nowhere and the card's behaviour panel says the school's records could not
  be read.
- **The bursary loop is code-complete and the migration is run; the loop itself is unproven.**
  `supabase/operations_state.sql` has been executed on this test project (verified 2026-11-05:
  `/api/school-config` returns the school's row, and `/api/fees`, `/api/term-closings`,
  `/api/result-publications`, `/api/students`, `/api/staff` and `/api/accounts` all answer from the
  database instead of naming a missing table). What has not been driven end-to-end against those
  live tables is the write path — Fee Structure → Bill → Record Payment → receipt in Transactions.
- **Every read route is now checked against the database; almost no write route is.**
  `supabase/traits_assessments.sql` ran successfully on 2026-11-05 after a first paste failed
  mid-file. A signed-in server read the same day confirmed it: `/api/traits-config` returns the
  school's fourteen-trait rubric and `/api/traits` answers `200` with no assessments filed — which is
  the truth, not an empty grid, because no form teacher has pressed *File this class into the
  school's records* on this project. `/api/ca` reads `200` empty, as do `/api/students` and
  `/api/invoices`; `/api/staff` returns the one login created here. So the reads are proven and the
  writes are not.
- **The stores and the timetable are real tables now, and nothing has been filed in them.**
  `supabase/inventory.sql` and `supabase/timetable.sql` were run on 2026-11-05, and a signed-in
  server read the same day proved the change: `/api/inventory`, `/api/timetable` and
  `/api/timetable/periods` answer `200` with an empty list instead of the `503` that named those
  files. The day shape comes back `configured: false`, so the grid prints the six periods the portal
  ships with and says out loud that they are the portal's and not the school's, until someone presses
  *Set the school's day*. `POST /api/timetable/generate` was run against those tables with a
  three-line plan and a stated load limit: it proposed 9 lessons, kept 0 (nothing was filed), left 51
  slots empty, named the one part of the plan that would not fit with how many were placed and why,
  showed no teacher in two rooms at once, and the grid still read empty afterwards — a draft files
  nothing by itself. What is **not** proven is every write: filing a lesson, filing a day shape, and
  receiving or issuing stock have never been sent to this database, and with both registers empty no
  screen has been seen reading real content. That distinction matters here, because a grid that looks
  unfilled because nobody filed a lesson is not distinguishable from one that looks unfilled because
  the read failed — which is why the `503` wording above is the guard rather than an empty table.
  What *is* proven of the generator is its logic, exercised outside the portal: 26 checks over the
  placement rule — no teacher in two arms at one time, a week's shape taken from the school's own
  periods and breaks, filed lessons kept and not buried, the stated load limit counted against both
  the plan and what is already on the record, and a part of a plan that will not fit reported with
  the number placed and the reason.
- **A parent's view is only as deep as the pupil record.** `/api/students` returns their children,
  `/api/invoices` their balances, `/api/ca` the per-subject marks, `/api/payments` the receipts and
  `/api/traits` the behaviour, attendance and remark half of the card — each filtered by
  `guardian_students` from the signed cookie, never from the request. The card prints a rating for
  a trait the school's own rubric still lists and, for anything else, the id it was stored under;
  it prints `not rated` for a trait the form teacher left unrated rather than a `0 / 5` a family
  would read as a mark of zero. What a parent cannot see is anything the form teacher never filed:
  a rating that stayed on the staff laptop is not on the school's record, and the card says *No
  character assessment on file for this pupil* instead of inventing one.
- **The invoicing page is one screen doing two jobs.** A Parent login may open it and sees only
  their own children's invoices and filed receipts. Every write control — *Bill n Enrolled Pupils*,
  *Record Payment* — is hidden unless `isActionAuthorized(role, "EDIT_FEES")` passes, which is the
  same pair of roles (`SUPER_ADMIN`, `ACCOUNTANT`) that `/api/invoices` and `/api/payments` accept,
  so a family is no longer offered a form the server can only refuse; in its place the page reads
  *Reading only. Take your payment evidence to the Bursary.* Splitting it into a separate parent
  view is still worth doing before parents are onboarded in quantity.
- **Grading is decided on the server; the card maths is not.** `POST /api/ca` derives
  `tier_grade` and `remark` from the total against that pupil's class scale in `grading_tiers` and
  ignores any grade the request sends. What still happens in the browser is the *reading* of those
  rows — averages, class positions and the pass-or-hold line on a score card or promotion screen —
  so two machines can disagree if one holds a stale copy of the marks. Moving that arithmetic
  server-side is the next change.
- **No password reset by email, and deliberately no "forgot password" link on the sign-in page.**
  A forgotten passcode is reset by a super admin: Settings → User Access → **New Password** on that
  person's row, which issues a replacement and signs out every device already holding the old one.
  There is no archive of issued passwords to look one up in — the row stores a salted scrypt hash,
  which is not a password — so the reset is the recovery path, not a fallback for it. Self-service
  reset by email needs Supabase Auth (`auth.users`) plus SMTP, which is the deliberate next step.
- **No email or SMS sending** — staff activation and notifications are manual.
- **No online payments** — invoices are tracked, not paid through the portal.
- **"Realtime" sync is per-browser** (`BroadcastChannel`), not server push across users.
- **The CBT "proctor" is a browser lockdown, and the screen says so.** It watches four things,
  because those are the four listeners attached: leaving full screen, tab or window focus loss,
  the blocked shortcuts (copy, paste, print-screen, right-click, F12) and the strike count that ends
  the sitting on the third. There is **no camera, microphone, face or gaze check** — the portal
  never asks `getUserMedia` — and the panel that used to print "AI Video Proctor", "HD 1080p",
  "Face Verified & Centered" and a decibel meter fed by `Math.random()` has been removed, because a
  child sat an exam believing their face was being watched. The incident log is filed on the school's
  records beside the sitting, but it records **what a browser detected, not what an invigilator
  saw**: nothing checked whether the child was alone. A finished CBT attempt shows a score and no
  verdict: the letter and remark come from the class scale when a teacher files the mark in
  *Update CA*.
- **Marking a CBT paper still happens in the browser, so the school's figure is the browser's.** The
  answers are stored with the questions (`cbt_questions.correct_answer_index`) because the machine
  that serves the paper is the machine that grades it, which is why the marked bank list and the
  bank export are shown only to the two logins that write it and never to a candidate. A sitting is
  filed as an attempt with `synced_to_ca` always `false`, and every screen that shows the figure says
  the mark is a person's to enter. The five *sample questions* that used to be written into
  `src/app/cbt/page.tsx` — an ICT paper whose answers shipped in the bundle, served whenever a
  browser had imported nothing — are gone: an empty bank now refuses to launch and says there is
  nothing to sit.
- **A login the browser cannot read paints nothing.** `DashboardShell` used to treat an unread
  session as `SUPER_ADMIN`, so a laptop that had just been handed over, or whose storage was
  cleared, listed every office screen with an administrator's menu. An unknown role now gets a
  waiting screen that names the login as the missing piece; the refused screen tells the visitor
  which roles do open that path (`rolesAllowedForPath` in `src/lib/rbac.ts`) instead of inventing a
  "Tier 1 / Tier 2 governance staff" clearance level.
- **The Head of School's endorsement is the head's to write.** On *Traits & Psychomotor* the
  endorsement preset selector and textarea are disabled for every role but `SUPER_ADMIN`, because
  whatever is typed there prints on the child's card under the principal's name. A card whose
  endorsement was never written prints *Endorsement withheld — the Head of School has not written
  one for this term*; an unwritten form master remark says so too, instead of a pair of empty quotes.

## Documentation

- [DOCUMENTATION.md](DOCUMENTATION.md) — roles, class hierarchy, grading tiers, module walkthrough
- [DEPLOYMENT.md](DEPLOYMENT.md) — Supabase + Render deployment steps
- [TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md](TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md) — QA onboarding
