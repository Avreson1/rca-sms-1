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
4. Open [`supabase/schema.sql`](file:///c:/Users/EGLF%20Media/OneDrive/Desktop/AVRESON/RCA_SMS/rca-sms/supabase/schema.sql) in this project, copy its entire contents, and paste it into the Supabase SQL editor.
5. Click **"Run"** (Green button).
6. Next, copy and run [`supabase/seed.sql`](file:///c:/Users/EGLF%20Media/OneDrive/Desktop/AVRESON/RCA_SMS/rca-sms/supabase/seed.sql) to initialize the official multi-tier grading matrix and baseline admin record (`dominic370`).

---

## 📦 Part 2: Pushing the Codebase to GitHub

You can push the project to GitHub using any of the following methods:

### Method A: Using VS Code / IDE Git UI (Easiest)
1. Open the **Source Control** tab on the left sidebar of your IDE (or press `Ctrl+Shift+G`).
2. Click **"Publish Branch"** or **"Commit & Push"**.
3. Select your GitHub account and choose **Create Private/Public Repository** `RCA_SMS`.

### Method B: Using GitHub Desktop
1. Open **GitHub Desktop**.
2. Click **File** → **Add Local Repository**.
3. Choose folder: `C:\Users\EGLF Media\OneDrive\Desktop\AVRESON\RCA_SMS`.
4. Click **Publish repository** to push it to your GitHub account.

### Method C: Using Git Bash / Terminal
If you have Git installed, run:
```bash
cd "c:\Users\EGLF Media\OneDrive\Desktop\AVRESON\RCA_SMS"
git init
git add .
git commit -m "feat: RCA SMS production ready with Supabase & Render integration"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/RCA_SMS.git
git push -u origin main
```

---

## ☁️ Part 3: Deploying on Render

1. Log into **[Render.com](https://render.com)**.
2. Click **"New +"** → **"Blueprint"** (or **"Web Service"**).
3. Connect your GitHub repository `RCA_SMS`.
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

### 2. How to Manually Create & Assign Staff / Tester Accounts (In-App)

As Super Admin, you can onboard testers and assign any specific role:

1. Log in to the portal as **Super Admin (`dominic370`)**.
2. Navigate to **Operations** → **Staff Management** ([`/operations/staff`](http://localhost:3000/operations/staff)).
3. Click **"Register Staff"** (or click **"Bulk Upload CSV"** if onboarding multiple testers at once).
4. Enter the tester's details:
   - **Full Legal Name**: e.g., *Mr. John Doe (QA)*
   - **Role Assignment**: Choose the exact role you want the tester to verify:
     - **Tier 1: Super Admin** (Executive & System Admin)
     - **Tier 2: Exam Officer** (Curriculum, Multi-Tier Grading, CBT Question Bank, Result Publication)
     - **Tier 3: Teacher** (CA Score Entry, Trait Ratings, Form Master)
     - **Bursar / Accountant** (Financial Audit, Invoicing, Transactions)
   - **Primary Teaching Subject**: e.g., *Mathematics*, *English*, or *Information Technology*.
   - **Assigned Form Class**: Select from *Pre-Play Class*, *Play Class*, *Nursery 1-2*, *Primary 1-5*, or *Secondary (JSS/SSS)*.
   - **Form Master**: Toggle whether they are form tutor for that class arm.
5. Click **"Register & Send Activation"**.
6. Note the generated **Staff ID** (e.g. `RCA/PERS/026`) and institutional email (e.g. `john_doe@royalcrownacademy.edu.ng`) to provide to your tester.

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
| **Tier 4: Student / Parent** | Taking proctored CBT exams (`/cbt`), inspecting published terminal report cards (`/operations/score-card`), fee invoices, and receipts. |
