# 🔑 Tester Credentials, GitHub Push & Render Cloud Deployment Guide

This guide provides instructions for connecting your Supabase project (`ycovxvfzmzfpehbozrut`), pushing your code to GitHub, deploying to Render, and **manually creating and assigning custom login credentials and roles to your QA testers**.

---

## 🏛️ Part 1: Your Active Supabase Credentials

Your project URL has been configured into `.env` and `.env.local`:

| Variable | Configured Value |
|---|---|
| **Project Reference** | `ycovxvfzmzfpehbozrut` |
| **Supabase URL** | `https://ycovxvfzmzfpehbozrut.supabase.co` |
| **Anon Public Key** | Stored only in `.env.local` (never commit it) |
| **Service Role Key** | Stored only in `.env.local` (server-side secret — never commit it) |

### ⚡ One-Time Database Initialization in Supabase:
1. Log into your **[Supabase Dashboard](https://supabase.com/dashboard/project/ycovxvfzmzfpehbozrut)**.
2. Click on the **SQL Editor** icon on the left sidebar.
3. Click **"New query"**.
4. Open [`supabase/schema.sql`](supabase/schema.sql) in this project, copy its entire contents, and paste it into the Supabase SQL editor.
5. Click **"Run"** (Green button).
6. Run [`supabase/harden-rls.sql`](supabase/harden-rls.sql) the same way to remove the old permissive public policies.
7. Next, copy and run [`supabase/seed.sql`](supabase/seed.sql) to initialize the official multi-tier grading matrix. (Login accounts are **not** stored in the database — they are created with environment variables, see Part 3/4.)

---

## 📦 Part 2: Pushing the Codebase to GitHub

The project repository is **`github.com/Avreson1/rca-sms-1`**. From the project folder:

```bash
cd "C:\Users\EGLF Media\Documents\Qoder\2026-10-29\5031ef7b"
git add .
git commit -m "feat: RCA SMS production ready with Supabase & Render integration"
git push origin main
```

If the push asks for credentials, sign in with your GitHub account in the popup (Git Credential Manager), or use a fine-grained personal access token as the password.

---

## ☁️ Part 3: Deploying on Render

1. Log into **[Render.com](https://render.com)**.
2. Click **"New +"** → **"Blueprint"** (or **"Web Service"**).
3. Connect your GitHub repository `rca-sms-1`.
4. Render will read `render.yaml`. Set the following environment variables when prompted:
   - `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: your Supabase anon key (Dashboard → Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY`: your Supabase service-role key (dashboard only, never commit)
   - `AUTH_SESSION_SECRET`: a long random string used to sign login sessions
   - `AUTH_SUPER_ADMIN_USERNAME` / `AUTH_SUPER_ADMIN_PASSWORD`: the administrator login
   - `AUTH_EXAM_OFFICER_*`, `AUTH_TEACHER_*`, `AUTH_ACCOUNTANT_*`, `AUTH_STUDENT_PARENT_*`: optional additional logins
   - `NODE_ENV`: `production`
5. Click **"Apply"** to deploy. Your portal will be live at `https://rca-sms.onrender.com`!

---

## 👥 Part 4: How to Manually Assign Login Details & Roles to Testers

You have full control over creating and assigning accounts to your testers. 

### 1. Primary Administrator Login (For You / Owner)

| Role | Username / ID | Recommended Email | Default Password | Access Level |
|---|---|---|---|---|
| **Step 1: Super Admin** | `dominic370` | `dominic370@royalcrownacademy.edu.ng` | Set via `AUTH_SUPER_ADMIN_PASSWORD` | Full System Control, Staff Creation, Student Enrollment, Fees, Broad Permissions. |

---

### 2. How to Manually Create & Assign Staff / Tester Accounts

There are two parts to onboarding a tester: the **staff record** (shown in the staff directory inside the app) and the **login account** (the username/password they actually sign in with).

**Step A — Create the staff record (in-app), as Super Admin:**

1. Log in to the portal as **Super Admin (`dominic370`)**.
2. Navigate to **Operations** → **Staff Management** ([`/operations/staff`](http://localhost:3000/operations/staff)).
3. Click **"Register Staff"** (or **"Bulk Upload CSV"** for multiple testers).
4. Enter the tester's details:
   - **Full Legal Name**: e.g., *Mr. John Doe (QA)*
   - **Role Assignment**: the role you want the tester to verify (Super Admin, Exam Officer, Teacher, or Accountant)
   - **Primary Teaching Subject**: e.g., *Mathematics*, *English*, or *Information Technology*.
   - **Assigned Form Class**: Select from *Pre-Play Class*, *Play Class*, *Nursery 1-2*, *Primary 1-5*, or *Secondary (JSS/SSS)*.
   - **Form Master**: Toggle whether they are form tutor for that class.
5. Click **"Register"** and note the generated **Staff ID** (e.g. `RCA/PERS/026`).

**Step B — Create the login account (environment variables):**

The app does not send activation emails. To give a tester a working login, add environment variables in Render (Dashboard → your service → Environment) using the pattern in `src/lib/auth/accounts.ts`:

```
AUTH_EXAM_OFFICER_USERNAME=john_doe_qa
AUTH_EXAM_OFFICER_PASSWORD=a-strong-password
AUTH_EXAM_OFFICER_NAME=Mr. John Doe (QA)
AUTH_EXAM_OFFICER_STAFF_ID=RCA/PERS/026
AUTH_EXAM_OFFICER_EMAIL=john_doe@royalcrownacademy.edu.ng
```

Use the prefix for the role you assigned: `AUTH_SUPER_ADMIN_`, `AUTH_EXAM_OFFICER_`, `AUTH_TEACHER_`, `AUTH_ACCOUNTANT_`, or `AUTH_STUDENT_PARENT_`. Only `USERNAME` and `PASSWORD` are required. Save the variables and let Render redeploy, then give the tester their username and password.

---

### 3. How to Manually Create Student & Parent Tester Accounts (In-App)

To test the **Student & Parent Portal (CBT Exams, Term Scorecards, Tuition Invoices)**:

1. Navigate to **Operations** → **Student Enrollment** ([`/operations/students`](http://localhost:3000/operations/students)).
2. Click **"Enroll Student"** (or **"Bulk Upload CSV"**).
3. Assign:
   - **Full Name**: e.g., *Test Pupil David*
   - **Class Level**: Select *Pre-Play Class*, *Play Class*, *Nursery 1-2*, *Primary 1-5*, or *Secondary*.
   - **House**: *Sapphire (Blue)*, *Ruby (Red)*, *Emerald (Green)*, or *Topaz (Yellow)*.
   - **Guardian Details**: Enter the guardian name and phone number.
4. Click **"Enroll Student"**.
5. Give the tester the **Admission Number** (e.g., `RCA/STD/2025/001`).

---

### 4. Role Hierarchy Overview for Testers

| Role Tier | Target Permissions & Responsibilities |
|---|---|
| **Tier 1: Super Admin** | Full institutional governance: tuition structure, staff management, grading policy authorization, and master broadsheet overrides. |
| **Tier 2: Exam Officer** | Multi-tier grading scales (`/setup/grading`), CBT Question Bank, academic broadsheets, timetable management, and result publication. |
| **Tier 3: Teacher** | Continuous Assessment score sheet entry (`/operations/update-ca`), affective & psychomotor trait matrix ratings, and classroom invigilation. |
| **Tier 4: Student / Parent** | Taking CBT exams (`/cbt`), inspecting published terminal report cards (`/operations/score-card`), fee invoices, and receipts. |
