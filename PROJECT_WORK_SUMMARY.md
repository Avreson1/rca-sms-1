# 🏛️ Royal Crown Academy — School Management & Virtual Classroom System (RCA SMS)
## Comprehensive Technical Inventory & Project Accomplishments Summary

**Institution:** Royal Crown Academy  
**Location:** No. 5 Resort Road, Rayfield, Jos South LGA, Plateau State, Nigeria  
**Institutional Motto:** *Excellence and Integrity*  
**Portal Name:** Virtual Classroom System (VCS) / School Management System (SMS)  
**Primary Administrator:** Dr. Dominic Mark (`dominic370` | Staff ID: `RCA/PERS/025`)  
**Assigned Subject & Form:** Information & Communication Technology (SS 2)  
**Document Generation Date:** October 2026  

---

## 📌 Executive Summary

The **Royal Crown Academy School Management System (RCA SMS)** is a cloud-native, production-grade educational ERP and Virtual Classroom System engineered specifically to accommodate the complete Nigerian curriculum spectrum—from early childhood sensory development (Creche & Playgroup) through basic elementary primary education to senior secondary school certificate preparation (WAEC, NECO, and BECE).

The system integrates an offline-first reactive state engine, multi-tab cross-window synchronization via the **BroadcastChannel API**, a serverless **Supabase Cloud PostgreSQL** database with Row-Level Security (RLS) and real-time socket publications, and a zero-downtime deployment blueprint configured for **Render**.

---

## 🛠️ Complete Technology Stack

| Layer | Technologies Employed | Architectural Purpose |
|---|---|---|
| **Frontend Framework** | **Next.js 16.3.1 (App Router)** & **React 19.2.8** | Server and client component rendering, route optimization, dynamic layouts |
| **Language & Typings** | **TypeScript 5** | Strict type safety across student records, grading brackets, fee structures, and staff permissions |
| **Styling & Design System** | **Tailwind CSS v4** & **PostCSS** | High-performance atomic CSS, custom color palettes (Scheme 1 & Scheme 2), print-ready stylesheets |
| **Component Icons** | **Lucide React (v1.46)** | Semantic icons across all navigation, operational status badges, and dashboards |
| **State & Data Store** | **Realtime Hybrid Reactive Store** (`realtime-store.ts`) | Offline-first `localStorage` + `BroadcastChannel` (cross-tab sync) + Supabase sync |
| **Backend Database** | **Supabase Cloud PostgreSQL** (`@supabase/supabase-js`) | Relational persistence, UUID primary keys, JSONB schemas, RLS policies |
| **Proctoring Engine** | Browser APIs (`Page Visibility`, `Fullscreen`, `KeyboardEvent`) | Anti-cheating failsafes, window blur tracking, devtools blocking, 3-strike expulsion |
| **CSV Engine** | Custom UTF-8 BOM Parser & Serializer (`csv-utils.ts`) | Ingestion and export for students, staff rosters, questions, and broadsheets |
| **Cloud Deployment** | **Render Blueprint** (`render.yaml`) & Supabase Cloud | Infrastructure-as-code, automatic builds, environment variable management |

---

## 🔐 1. Granular Role-Based Access Control (RBAC) System

A 4-step (5-role) institutional governance hierarchy has been implemented with dedicated route guards (`rbac.ts`), action authorization gates, dynamic navigation rendering, and simulated login accounts:

| Tier | Role Code | Institutional Designation | Scope of Privileges & Responsibilities |
| :---: | :--- | :--- | :--- |
| **Tier 1** | `SUPER_ADMIN` | Executive, Proprietor & Principal | Full institutional governance: tuition setup, staff registration & granular permission assignment, master grading scale authorization, score overrides, audit log inspection, and database purge. |
| **Tier 2** | `EXAM_OFFICER` | Academic Directorate & Dean of Studies | Curriculum subject packages, tier grading scales, Continuous Assessment structure weighting, CBT exam banks, proctoring audits, academic timetable, and broadsheet publication. |
| **Tier 3** | `TEACHER` | Form Master & Subject Teacher | Continuous Assessment mark entry (filtered to assigned subject/class), affective & psychomotor trait matrix scoring, attendance tracking, and classroom invigilation. |
| **Tier 4** | `ACCOUNTANT` | Bursar & Accounts Officer | Fee line-item configurations, student tuition invoicing, payment recording, debt reconciliation, and official receipt generation. |
| **Tier 5** | `STUDENT_PARENT` | Student & Parent Guardian Portal | View published terminal scorecards (restricted strictly to their ward), take CBT examinations, inspect fee invoices and payment clearance status, internal inmail messaging. |

### Implemented Security Features:
- **Route Guard Engine (`isRouteAllowed`)**: Enforces allowed prefixes and denied paths per role.
- **Action Authorization Engine (`isActionAuthorized`)**: Restricts high-stakes operations (`SYSTEM_PURGE`, `EDIT_SETUP`, `EDIT_FEES`, `PUBLISH_RESULTS`, `ENTER_CA`, `EDIT_STAFF`).
- **Interactive Multi-Role Switcher**: Live session dropdown in the top navigation bar allowing administrators and QA testers to switch between roles on the fly.
- **Dedicated Authentication Portal (`/login`)**: Custom credential validator matching preset accounts and staff profiles, with error handling, session persistence, and logout flow.

---

## 🏫 2. Class Hierarchy & Educational Divisions

The system supports the full pedagogical hierarchy of the institution across 5 distinct school divisions:

1. **Creche & Playgroup (Early Childhood)**
   - *Pre-Play Class* (Toddler sensory & motor exploration)
   - *Play Class* (Foundational social and linguistic readiness)
2. **Nursery School**
   - *Nursery 1* & *Nursery 2* (Early phonics, letter formation, quantitative readiness, health habits)
3. **Basic Primary Education (Universal Basic Education)**
   - *Primary 1*, *Primary 2*, *Primary 3*, *Primary 4*, *Primary 5* (National elementary curriculum: English, Mathematics, Basic Science & Tech, Social Studies, ICT, Agriculture, CCA, CRS, Reasoning)
4. **Junior Secondary School (JSS)**
   - *JSS 1*, *JSS 2*, *JSS 3* (Basic Education Certificate Examination - BECE curriculum)
5. **Senior Secondary School (SSS)**
   - *SS 1*, *SS 2*, *SS 3* (Specialized Science, Arts, and Commercial tracks for WAEC, NECO, and JAMB UTME)

---

## 📊 3. Continuous Assessment (CA) & Adjustable Multi-Tier Grading Engine

### A. The 40:60 Continuous Assessment Ratio
Enforces the standard Nigerian institutional evaluation formula:
$$\text{Terminal Total (100 Marks)} = \text{1st Test (10)} + \text{2nd Test (10)} + \text{Project (10)} + \text{Mid-Term (10)} + \text{Terminal Exam / CBT (60)}$$

### B. Adjustable Multi-Tier Grading Center (`/setup/grading`)
Because developmental evaluation differs drastically between daycare toddlers and senior secondary school students, 4 independent, customizable grading scales have been implemented:

1. **Tier 1: Creche & Playgroup (Pre-Play & Play Class)**
   - `EE` (85% – 100%): *Exceeding Expectations* (4.0 GPA)
   - `ME` (70% – 84%): *Meeting Expectations* (3.5 GPA)
   - `AE` (50% – 69%): *Approaching Expectations* (2.5 GPA)
   - `EM` (0% – 49%): *Emerging Learner* (1.0 GPA)
2. **Tier 2: Nursery School (Nursery 1 & 2)**
   - `A+` (90% – 100%): *Exceptional Mastery* (5.0 GPA)
   - `A` (80% – 89%): *Excellent Performance* (4.0 GPA)
   - `B` (70% – 79%): *Very Good Understanding* (3.0 GPA)
   - `C` (60% – 69%): *Good Progress* (2.0 GPA)
   - `D` (0% – 59%): *Needs Encouragement & Practice* (1.0 GPA)
3. **Tier 3: Basic Primary Education (Primary 1 - 5)**
   - `A*` (90% – 100%): *Outstanding Distinction* (5.0 GPA)
   - `A` (80% – 89%): *Excellent Performance* (4.0 GPA)
   - `B` (70% – 79%): *Very Good* (3.5 GPA)
   - `C` (60% – 69%): *Good / Commendable* (3.0 GPA)
   - `D` (50% – 59%): *Satisfactory / Average* (2.0 GPA)
   - `E` (40% – 49%): *Fair / Marginal Pass* (1.0 GPA)
   - `F` (0% – 39%): *Unsatisfactory / Fail* (0.0 GPA)
4. **Tier 4: Secondary Education (JSS 1-3 & SS 1-3 - WAEC 9-Point Scale)**
   - `A1` (75% – 100%): *Distinction* (4.0 GPA)
   - `B2` (70% – 74%): *Very Good* (3.5 GPA)
   - `B3` (65% – 69%): *Good* (3.0 GPA)
   - `C4` (60% – 64%): *Credit* (2.5 GPA)
   - `C5` (55% – 59%): *Credit* (2.0 GPA)
   - `C6` (50% – 54%): *Credit* (1.5 GPA)
   - `D7` (45% – 49%): *Pass* (1.0 GPA)
   - `E8` (40% – 44%): *Pass* (0.5 GPA)
   - `F9` (0% – 39%): *Fail* (0.0 GPA)

### C. Live Gradebook Computation
- Threshold adjustments in the Grading Center instantly recalculate total marks, letter grades, remarks, class averages, and rank positions across all student scorecards in real time.

---

## 💻 4. Computer-Based Testing (`/cbt`) — a browser-graded paper on the school's records

The exam runs, and is marked, inside the browser that serves it: the questions carry their own right
answer because there is no server-side marker. What the school's records hold is the paper, the
sitting and the switch.

- **The paper is the school's, not the machine's** (`cbt_questions` via `/api/cbt/questions`). The
  exam office types a question or loads a CSV on the *CBT* screen's manage tab, previews it, and
  files it; every other machine then serves the same paper. Nothing is filed until the office presses
  *File these n question(s)*, and a CSV row the school refuses comes back named.
- **The sitting is filed as an attempt** (`cbt_exam_sessions` via `/api/cbt/sessions`). When a sitting
  ends, the browser posts the figure it worked out, the question count and the incident log; the
  server resolves the pupil from `students`, refuses anyone who is not on the register, refuses a
  score above the paper's marks, refuses a closed term, and writes `synced_to_ca` **false**. No CBT
  figure reaches a mark column by itself — *Update CA* shows the attempt beside each pupil's name and
  the person enters the mark.
- **The lockdown switch is one switch for every machine** (`cbt_settings` via `/api/cbt/settings`).
  It cannot be opened without naming what the module is being used for and the hours it runs in, it
  records who moved it last, and the candidate-facing closed screen prints the school's own notice.
  Candidates read the switch (a locked door must say who shut it) but cannot move it.
- **Proctoring is four browser listeners, and the screen says so**: full-screen exit, tab or window
  focus loss, the blocked shortcuts (copy, paste, print-screen, right-click, F12), and the third
  strike that ends the sitting and scores it 0. There is **no camera, microphone, face or gaze
  check** — the old "AI Video Proctor" panel and its `Math.random()` decibel meter were removed
  because a child believed their face was being watched. The incident log is filed beside the
  attempt as *what a browser detected*.
- **Answers are not shown to the people who must not read them.** The marked bank list, the answer
  highlight and the CSV export (which carries the answers) are limited to the two logins that write
  the bank; a candidate is not shown the bank at all, and an empty bank refuses to launch rather than
  serving the five sample questions that used to be written into the page's own source.

---

## 📄 5. Terminal Report Cards & Broadsheets (`/operations/score-card` & `/reports`)

### A. Terminal Scorecard Engine (`/operations/score-card`)
- **6 Print-Ready Branding Color Schemes**:
  1. *Scheme 1 (Flagship)*: Vibrant Royal Blue (`#0000FF` 60%), Cyan (`#00FFFF` 25%), Vivid Red (`#FF0000` 10%), White (`#FFFFFF` 5%).
  2. *Scheme 2*: Deep Corporate Navy (`#0B2F9E`), Bright Magenta (`#FF00FF`), Crimson Red (`#D90429`), Off-White (`#F8F9FA`).
  3. *Emerald Green & Forest Slate*
  4. *Burgundy Wine & Gold*
  5. *Classic Gold & Royal Navy*
  6. *Executive Slate & Charcoal*
- **Comprehensive Scorecard Layout**:
  - School Crest, Motto, and Contact Header
  - Student Bio-Data, Admission Number, Passport Frame, School House Badge (Sapphire, Ruby, Emerald, Topaz)
  - Curricular Subject Breakdown: 1st Test (10), 2nd Test (10), Project (10), Mid-Term (10), Terminal Exam (60), Total Score (100), Tier Grade, Class Average, Subject Highest, Subject Lowest, Position/Rank (with ordinal formatting: 1st, 2nd, 3rd...), and Remarks
  - Cumulative Summary: Total Marks, Overall Percentage, Term Average, Cumulative GPA, and Final Class Rank
  - Behavioral & Traits Matrix: Affective domain (Punctuality, Politeness, Neatness, Honesty, etc.) and Psychomotor domain (Handwriting, Sports, Dexterity, Craft, etc.) on a 1–5 scale
  - Form Teacher & Principal remarks with signature and digital stamp containers
  - Next term resumption date and bulletin excerpt integration
  - Native print formatting (`@media print`) and export utilities.

### B. Broadsheet & Reporting Hub (`/reports`)
- **Master Academic Broadsheet Export**: Generates full class-wide CSV broadsheets with individual test breakdown, totals, grades, and remarks.
- **Debtor & Fee Clearance Ledger**: Generates real-time financial broadsheets listing student billing, amounts paid, outstanding balances, and clearance status.

---

## 👥 6. Faculty & Student Management (`/operations/staff` & `/operations/students`)

### A. Staff Directory & Granular Provisioning (`/operations/staff`)
- **Single Staff Registration Modal**: Full Legal Name, Staff ID (e.g. `RCA/PERS/026`), institutional email (`@royalcrownacademy.edu.ng`), phone number, role tier, assigned subject, assigned class arm, and Form Master toggle.
- **Granular Staff Permissions Matrix**: Toggle checkboxes for `canCreateStudents`, `canEditStudents`, `canDeleteStudents`, `canEnterScores`, `canEditScores`, `canPublishResults`, `canEditFees`, `canManageCurriculum`, `canEditAttendance`, `canApprovePromotions`.
- **Bulk CSV Staff Ingestion**: Automated multi-teacher onboarding via CSV parser.
- **Private Access Memo Generator**: Generates a printable or copyable security memo with credentials and onboarding instructions for new staff.

### B. Student Enrollment Desk (`/operations/students`)
- **Single Pupil Enrollment**: Full Name, Class Level (Pre-Play to SS 3), Gender, Guardian Name, Guardian Phone, School House, and Fee Status.
- **Automated Admission Number Generator**: Format `RCA/STD/2025/XXX`.
- **Bulk CSV Student Enrollment**: Parses and validates CSV files, displays interactive preview tables, and performs bulk ingestions.

---

## ⚙️ 7. Full Academic & Operational Workflow Modules

### Operations Suite (`/operations/*`)
1. **Academics & Timetable (`/operations/academics`)**: The term's grid read from the school's own records for one named session and term, one lesson filed into one labelled slot, a teacher already booked elsewhere refused with the other class named, the school's own day shape (periods, breaks, weekdays) as a record it can file, a clash-free week drafted from a plan a person writes and filed only when they press so, room numbers, and teacher workload read off the same grid. `supabase/timetable.sql` has to be run for any of it to hold data.
2. **Update CA Gradebook (`/operations/update-ca`)**: Real-time Continuous Assessment spreadsheet with auto-saving, score clamping (Tests 0-10, Exam 0-60), class/subject filtering, and bulk CSV score upload.
3. **Traits & Psychomotor Scoring (`/operations/traits-assessments`)**: 5-point rating matrix for behavioral and physical traits with preset auto-fill remarks for teachers and principals.
4. **Publish Results (`/operations/publish-results`)**: Arm-by-arm result lock/publish toggle with timestamp auditing, controlling scorecard visibility on the student/parent portal.
5. **Student Promotion Engine (`/operations/promotion`)**: Automated class-to-class promotion with 50% pass threshold qualification filters.
6. **End-of-Term Processing (`/operations/end-term`)**: Term closeout checklist, broadsheet archival, and session transition.
7. **SMS & Email Communications (`/operations/send-sms`, `/operations/send-email`)**: Parent broadcast consoles for fees, emergency notices, and term resumption.
8. **Daily Duty Roster (`/operations/duties`)**: Who is on duty for which part of which named day, filed against a real staff record by an office login that is recorded on the row. The week is built on the school's own date (`Africa/Lagos`, not the host's), a teacher or bursar reads only the rows filed against their own staff number, and the dashboard prints today's duties beside the designations the register holds. One duty per person per part of a day is enforced by the database, not the screen. `supabase/staff_duties.sql` has to be run for any of it to hold data; until then both the roster and the panel say the roster could not be read, and refuse to print an empty week in its place.

### Setup & Configuration Suite (`/setup/*`)
1. **Academic Calendar (`/setup/calendar`)**: The term's milestones and the activity blueprints they are scheduled from, filed on the school's records so every machine reads the same dates. A milestone carries the session and term the school says it is in, its date as the school's own words (blank means *the date has not fixed*, never *TBD*), one of eight categories so a sports day is not filed as *Academic*, and a status an office login moves; the same title in the same session and term is refused instead of doubled. A blueprint may be left blank in every field but its name, and blanks print as *not said* rather than as a venue, a coordinator or a budget the portal guessed. `supabase/calendar.sql` has to be run for any of it to hold data; until then both lists are this browser's copy, the screen says so, and every *File…* button refuses with the sentence naming that file. It seeds nothing — the seven starter milestones and the six sample blueprints the portal used to ship arrive only when somebody presses the button that calls them a starting outline, and they arrive undated.
2. **Sections (`/setup/sections`)**: Creche, Nursery, Primary, JSS, and SSS section configuration.
3. **Classes (`/setup/classes`)**: The arms the school actually runs, filed on its own records. An arm is named, placed in a section, given a form master from the staff register and a capacity; the number printed against it is the children counted from `students`, never a figure typed into this screen. An arm that still holds pupils is refused on deletion with the arms named. `supabase/classes_and_subjects.sql` has to be run for any of it to hold data; until then the screen works from this browser's list and says so.
4. **Subjects (`/setup/subjects`)**: Master directory of subjects, filed per name and band on the school's records, with the arms each is taught to held as names (single add, bulk add, CSV import, CSV export). A subject whose CA marks are still filed is refused on deletion and named, because removing the line would orphan the marks.
5. **Subject Templates (`/setup/subject-templates`)**: Standard curriculum packages assigned to each education tier, filed on the school's records so the CA grid offers the same shortcut on every machine. A package is a plan, not a register: it holds no pupil count.
6. **Fees Configuration (`/setup/fees`)**: Line-item breakdown of tuition, ICT levy, examination fees, and development levies.
7. **CA Structure (`/setup/ca-structure`)**: What the school states each tier's assessment is made of — an ordered list of components with their marks and the school's own note about that tier, filed one row per tier on the school's records so every machine reads the same statement. It seeds nothing: the four distributions the portal used to ship arrive only when somebody presses the button that calls them a starting outline, and that button says the outline is the software author's, not the school's approval. Filing a structure does **not** re-derive a mark — the gradebook still adds the five columns written into its own code, and both screens say so on their face. `supabase/ca_structure_and_bulletin.sql` has to be run for any of it to hold; until then the screen counts 0 of 4 tiers filed, calls the list this browser's copy, and refuses every filing with the sentence naming that file.
8. **Grading Scales (`/setup/grading`)**: Multi-tier bracket editor for marks, GPA points, remarks, and badge colors.
9. **Minimum Pass Scores (`/setup/pass-scores`)**: Benchmark promotion thresholds per grade level.
10. **Traits & Domains (`/setup/traits`)**: Affective and psychomotor criteria library.
11. **School Houses (`/setup/houses`)**: House sports affiliations (Sapphire, Ruby, Emerald, Topaz).
12. **Report Card Theme & Newsletter (`/setup/report-templates`)**: Two records on the school's own tables. The card theme is one standing row — which of the six schemes every machine opens a card in — and the terminal circular is one row per session and term, so a Third Term card prints the words written for Third Term and, when none were written, prints *"no circular has been filed for this term"* instead of last term's. Nothing is seeded: the resumption date, the fee deadline and the bank account that used to ship inside the portal now start blank, because a printed account number sends families money. The scheme picked on the score-card screen is a choice about the sheets in that printer and never writes this row. `supabase/ca_structure_and_bulletin.sql` has to be run for either to hold.

---

## 💰 8. Accounts, Bursary & Invoicing Suite (`/accounts/*`)

- **Student Invoicing Desk (`/accounts/invoicing`)**: Automated generation of term invoices for all enrolled students based on active fee structures.
- **Payment Processing (`/accounts/payment`)**: Records partial and full payments with real-time balance reconciliation and debt status updates (`Outstanding`, `Partially Paid`, `Fully Cleared`).
- **Financial Audit Ledger (`/accounts/transactions`)**: Searchable, filterable audit log of all financial transactions and payment channels (Bank Transfer, POS, Cash, Direct Portal).

---

## 📬 9. Communication & Manuals

- **Internal Inmail Desk (`/inmail`)**: Inter-departmental messaging system between administration, teachers, accountants, and parents.
- **Standard Operating Procedures (SOP) Manual (`/video-guides`)**: Role-based operational manual with step-by-step procedures, safety guidelines, and prerequisites for Super Admins, Exam Officers, Teachers, and Bursars.
- **System Settings (`/settings`)**: School profile editor, term resumption dates, CBT engine lock toggle, demo data purge, and seed data restore.

---

## 🗄️ 10. Database Schema & Supabase Architecture

The database architecture is designed with **Supabase PostgreSQL**, utilizing Row-Level Security (RLS) and real-time replication:

### Implemented Tables (`schema.sql`):
1. `public.staff`: Faculty records, roles (`user_role_tier`), assigned classes/subjects, Form Master flags, and timestamps.
2. `public.students`: Enrollment records, admission numbers, class names, school houses, guardian contacts, fee payment statuses.
3. `public.ca_scores`: 40:60 Continuous Assessment scores (`test1`, `test2`, `project`, `mid_term`, `exam`), generated `total_score`, letter grades, remarks.
4. `public.grading_tiers`: Multi-tier bracket configurations stored as JSONB.
5. `public.cbt_questions`: Question repository, choices JSONB, correct answers, and marks.
6. `public.cbt_exam_sessions`: Proctored examination attempts, raw scores, violation strike tallies, malpractice event logs JSONB, CA sync status.
7. `public.invoices`: Student fee invoices, amounts billed, amounts paid, and payment statuses.
8. `public.transactions`: Payment transactions, reference numbers, payment channels, and timestamps.
9. `public.audit_logs`: Administrative change history and system audit trail.
10. `public.inmail_messages`: Internal messaging mailbox, sender, recipient, subject, body, read status.
11. `public.cbt_settings`: the switch that opens or shuts the exam portal, the purpose it is open for,
    the hours it runs in, the notice a locked screen prints, and who moved it last — created by
    `supabase/cbt.sql` rather than `schema.sql`, which also adds the sitting columns the older file
    never gave `cbt_exam_sessions`.
12. `public.school_calendar_events`: one milestone per session, term and title — the date as the
    school wrote it (`date_range` is text; empty means the date has not been fixed, which the screen
    prints in those words), the category, the status, and which login filed or corrected the row.
    Created by `supabase/calendar.sql`, which seeds no row.
13. `public.activity_templates`: a reusable activity blueprint — its name, category, who it is for,
    who leads it, where it is held, what it costs, the objectives and how many days it runs — with
    every field but the title allowed to stay empty. Also created by `supabase/calendar.sql`.
14. `public.ca_component_structures`: what the school states one tier's assessment is made of — the
    components in teaching order (1–12, each with its own marks) and the school's note about that
    tier, one row per tier, filed and corrected by a named login. Created by
    `supabase/ca_structure_and_bulletin.sql`, which seeds no row and stores no total or weight: the
    marks are the fact, and the gradebook does not yet read this table.
15. `public.report_card_settings`: exactly one row — which of the six colour schemes the cards are
    printed in, and who filed it. The scheme chosen on the score-card screen is a print-run choice
    and never writes here. Also created by `supabase/ca_structure_and_bulletin.sql`.
16. `public.terminal_newsletters`: one circular per session and term — the title, the principal's
    address and signatory, the resumption wording, the key events as a list, the fee policy, the bank
    details and the special advisory, each allowed to stay empty and printed as empty when it is. The
    score card prints the row labelled with the term it is printing for, or says none is filed. Also
    created by `supabase/ca_structure_and_bulletin.sql`, which seeds no row.

Every feature built after `schema.sql` ships its own file in `supabase/` (the list, in run order, is
in [DEPLOYMENT.md](DEPLOYMENT.md)): each creates or extends its tables, enables RLS with **no**
policies, and grants the table to `service_role` alone. A project that ran only `schema.sql` has the
tables but no access to them, so those screens fall back to the copy held on the browser and say so.

### Realtime Publications:
- Enabled on `students`, `staff`, `ca_scores`, `cbt_exam_sessions`, `invoices`, `transactions`, and `grading_tiers` for instant live updates across client sessions.

### Baseline Seed Data (`seed.sql`):
- Initializes the default Super Administrator account (`dominic370` / `RCA/PERS/025`).
- Seeds the official 4-tier grading scales for Creche/Playgroup, Nursery, Primary, and Secondary divisions.

---

## ☁️ 11. Deployment & DevOps Readiness

### A. Render Blueprint (`render.yaml`)
- Configured as a declarative Infrastructure-as-Code blueprint for **Render Web Services**:
  - Runtime: Node.js
  - Root directory: `rca-sms`
  - Build command: `npm install && npm run build`
  - Start command: `npm run start`
  - Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`, `NODE_ENV`.

### B. Deployment & Tester Guides
Three detailed guides have been written for users, developers, and QA testers:
1. `DOCUMENTATION.md`: Complete institutional and operational technical manual.
2. `DEPLOYMENT.md`: Cloud deployment walkthrough for Render, Supabase, Vercel, and Linux VPS.
3. `TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md`: Step-by-step instructions for QA testers, default role credentials, and manual account assignment protocols.

---

## 📂 12. Complete Codebase Inventory

```
RCA_SMS/
├── DEPLOYMENT.md
├── DOCUMENTATION.md
├── TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md
├── PROJECT_WORK_SUMMARY.md
├── package.json
├── render.yaml
├── prisma/
│   └── schema.prisma
└── rca-sms/
    ├── package.json
    ├── next.config.ts
    ├── tsconfig.json
    ├── render.yaml
    ├── supabase/
    │   ├── schema.sql
    │   └── seed.sql
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx (Dashboard Home)
        │   ├── login/page.tsx
        │   ├── cbt/page.tsx (Proctored Exam & Question Bank)
        │   ├── inmail/page.tsx
        │   ├── reports/page.tsx (Broadsheets & Debtor Lists)
        │   ├── settings/page.tsx
        │   ├── video-guides/page.tsx (SOP Manual)
        │   ├── accounts/
        │   │   ├── invoicing/page.tsx
        │   │   ├── payment/page.tsx
        │   │   └── transactions/page.tsx
        │   ├── operations/
        │   │   ├── academics/page.tsx
        │   │   ├── end-term/page.tsx
        │   │   ├── promotion/page.tsx
        │   │   ├── publish-results/page.tsx
        │   │   ├── score-card/page.tsx
        │   │   ├── send-email/page.tsx
        │   │   ├── send-sms/page.tsx
        │   │   ├── staff/page.tsx
        │   │   ├── students/page.tsx
        │   │   ├── traits-assessments/page.tsx
        │   │   └── update-ca/page.tsx
        │   ├── setup/
        │   │   ├── ca-structure/page.tsx
        │   │   ├── calendar/page.tsx
        │   │   ├── classes/page.tsx
        │   │   ├── fees/page.tsx
        │   │   ├── grading/page.tsx
        │   │   ├── houses/page.tsx
        │   │   ├── pass-scores/page.tsx
        │   │   ├── report-templates/page.tsx
        │   │   ├── sections/page.tsx
        │   │   ├── subject-templates/page.tsx
        │   │   ├── subjects/page.tsx
        │   │   └── traits/page.tsx
        │   └── api/
        │       ├── ca/route.ts
        │       ├── invoices/route.ts
        │       ├── presence/route.ts
        │       ├── staff/route.ts
        │       └── students/route.ts
        ├── components/
        │   ├── dashboard/
        │   │   ├── email-banner.tsx
        │   │   ├── subjects-card.tsx
        │   │   └── users-online.tsx
        │   └── layout/
        │       ├── dashboard-shell.tsx
        │       ├── navbar.tsx
        │       └── sidebar.tsx
        └── lib/
            ├── constants.ts
            ├── csv-utils.ts
            ├── rbac.ts
            ├── realtime-store.ts (Comprehensive Reactive Store)
            ├── utils.ts
            └── supabase/
                ├── client.ts
                ├── db.ts
                └── server.ts
```

---

*Summary verified for Royal Crown Academy Virtual Classroom & School Management System.*
