# Royal Crown Academy — Virtual Classroom System (VCS)
## Comprehensive Technical Manual: 4-Step RBAC, Class Hierarchy (Pre-Play to Primary 5 & Secondary) & Adjustable Multi-Tier Grading

**Institution:** Royal Crown Academy  
**Location:** No 5 Resort Road, Rayfield, Jos South LGA, Plateau State, Nigeria  
**Motto:** *Excellence and Integrity*  
**System Scope:** Single-Tenant School Management & Virtual Classroom System (VCS)  
**Primary Administrator:** `dominic370` (Staff ID: `RCA/PERS/025`)  
**Assigned Subject:** Information & Communication Technology (SS 2A)

---

## Table of Contents
1. [4-Step Role-Based Access Control (RBAC) System](#1-4-step-role-based-access-control-rbac-system)
2. [Complete Class Hierarchy (Pre-Play to Primary 5 & Secondary)](#2-complete-class-hierarchy-pre-play-to-primary-5--secondary)
3. [Adjustable Multi-Tier Grading Engine](#3-adjustable-multi-tier-grading-engine)
4. [How to Add and Manage Staff](#4-how-to-add-and-manage-staff)
5. [Cloud Deployment (Render + Supabase)](#5-cloud-deployment-render--supabase)
6. [Continuous Assessment (CA) Gradebook & Result Publishing](#6-continuous-assessment-ca-gradebook--result-publishing)
7. [Current Security Posture & Limitations](#7-current-security-posture--limitations)

---

## 1. 4-Step Role-Based Access Control (RBAC) System

The portal implements an enterprise 4-Step RBAC hierarchy that governs module visibility, write authorizations, and sensitive financial/grading access:

| Step | Role Code | Institutional Designation | Authorized Privileges |
| :--- | :--- | :--- | :--- |
| **Step 1** | `SUPER_ADMIN` | Executive, Proprietor & Head of School | Full institutional control: tuition structure, staff management, grading policy authorization, master score overrides, and database purge. |
| **Step 2** | `EXAM_OFFICER` | Academic Directorate & Exam Controller | Curriculum subject packages, tier grading adjustment (`/setup/grading`), CBT exam pools, and result publication. |
| **Step 3** | `TEACHER` | Teaching Staff & Form Masters | Continuous Assessment (CA) score entry, affective/psychomotor trait matrix grading, attendance registers, and classroom invigilation. |
| **Step 4** | `STUDENT_PARENT` | Student & Parent Portal | Take CBT examinations, view published terminal report cards (`/operations/score-card`), inspect fee invoices, and download payment receipts. |

*Note: Each user signs in with their own username and password on the login page. The role assigned to that account determines which modules are visible. There is no role-switching dropdown — to test a different tier, log out and sign in with that tier's credentials.*

---

## 2. Complete Class Hierarchy (Pre-Play to Primary 5 & Secondary)

Royal Crown Academy operates across early childhood, basic primary, and secondary divisions:

### 1. Creche & Playgroup
- **Pre-Play Class** (Daycare / Toddler Sensory & Motor Exploration)
- **Play Class** (Pre-Nursery Foundational Social & Linguistic Skills)

### 2. Nursery School
- **Nursery 1**
- **Nursery 2**
- *Focus:* Phonics, early literacy, quantitative readiness, handwriting, and social etiquette.

### 3. Basic Primary Education (Primary 1 - 5)
- **Primary 1**
- **Primary 2**
- **Primary 3**
- **Primary 4**
- **Primary 5**
- *Focus:* Literacy, mathematics, basic science & technology, civic values, cultural arts, and agricultural science.

### 4. Junior Secondary School (JSS)
- **JSS 1A / JSS 2A / JSS 3A**
- *Focus:* National Basic Education Certificate Examination (BECE) curriculum.

### 5. Senior Secondary School (SSS)
- **SS 1A / SS 2A / SS 3A**
- *Focus:* Specialized Science, Arts, and Commercial tracks for WAEC, NECO, and JAMB UTME.

---

## 3. Adjustable Multi-Tier Grading Engine

Because developmental evaluation differs radically between toddler stages and basic primary education, the portal provides a fully **Adjustable Multi-Tier Grading Center** at **[`/setup/grading`](http://localhost:3000/setup/grading)**.

### Tier 1: Creche & Playgroup (Pre-Play & Play Class)
- **`EE` (85% – 100%):** *Exceeding Expectations (Advanced Mastery)* — 4.0 GPA
- **`ME` (70% – 84%):** *Meeting Expectations (Proficient Development)* — 3.5 GPA
- **`AE` (50% – 69%):** *Approaching Expectations (Developing)* — 2.5 GPA
- **`EM` (0% – 49%):** *Emerging (Requires Targeted Support)* — 1.0 GPA

### Tier 2: Nursery School (Nursery 1 & 2)
- **`A+` (90% – 100%):** *Outstanding Progress* — 4.0 GPA
- **`A` (80% – 89%):** *Excellent Performance* — 3.8 GPA
- **`B` (70% – 79%):** *Very Good Understanding* — 3.0 GPA
- **`C` (60% – 69%):** *Good / Satisfactory* — 2.5 GPA
- **`D` (0% – 59%):** *Needs Encouragement & Practice* — 1.0 GPA

### Tier 3: Basic Primary Education (Primary 1 - 5)
- **`A*` (90% – 100%):** *Outstanding Distinction* — 4.0 GPA
- **`A` (80% – 89%):** *Excellent Performance* — 3.8 GPA
- **`B` (70% – 79%):** *Very Good* — 3.0 GPA
- **`C` (60% – 69%):** *Good / Commendable* — 2.5 GPA
- **`D` (50% – 59%):** *Satisfactory / Pass* — 2.0 GPA
- **`E` (40% – 49%):** *Fair / Marginal Pass* — 1.0 GPA
- **`F` (0% – 39%):** *Needs Serious Improvement* — 0.0 GPA

### Tier 4: Secondary Education (JSS 1-3 & SS 1-3)
- **`A1` (75% – 100%):** *Excellent / Distinction* — 4.0 GPA
- **`B2` (70% – 74%):** *Very Good* — 3.5 GPA
- **`B3` (65% – 69%):** *Good* — 3.0 GPA
- **`C4` (60% – 64%):** *Credit* — 2.5 GPA
- **`C5` (55% – 59%):** *Credit* — 2.0 GPA
- **`C6` (50% – 54%):** *Credit* — 1.5 GPA
- **`D7` (45% – 49%):** *Pass* — 1.0 GPA
- **`E8` (40% – 44%):** *Pass* — 0.5 GPA
- **`F9` (0% – 39%):** *Fail* — 0.0 GPA

### How to Adjust Grading Thresholds:
1. Navigate to **[Setup > Grading System](http://localhost:3000/setup/grading)**.
2. Select the target tier tab (e.g. *Pre-Play & Play*, *Nursery 1-2*, or *Primary 1-5*).
3. Modify the minimum/maximum score numbers, remarks, or GPA weights directly in the table.
4. Click **"Save & Sync Scale"**.
5. All student gradebooks (`/operations/update-ca`) and report cards (`/operations/score-card`) recompute automatically!

---

## 4. How to Add and Manage Staff

Staff registration and teaching workload allocation are handled through the **Staff Management Module** (`/operations/staff`).

### Step-by-Step Staff Registration Workflow
1. Navigate to **[Operations > Staff Directory](http://localhost:3000/operations/staff)**.
2. Click the **"Register New Staff"** button.
3. Complete the modal form:
   - **Full Legal Name** (e.g. *Mrs. Sarah K. Danjuma*)
   - **Role Assignment** (`SUPER_ADMIN`, `EXAM_OFFICER`, `TEACHER`, `ACCOUNTANT`)
   - **Primary Teaching Subject** (e.g. *General Mathematics*, *Early Childhood Phonics*)
   - **Assigned Form Class Arm** (e.g. *Pre-Play Class*, *Nursery 1*, *Primary 5*, *SS 2A*)
   - **Form Master Toggle** (Check if this staff is the principal classroom tutor)
   - **Phone Number** (Nigerian format: `0803XXXXXXX`)
4. Click **"Register & Send Activation"**:
   - The system automatically generates a unique Staff ID: `RCA/PERS/XXX`
   - Generates the official institutional email: `[name]@royalcrownacademy.edu.ng`
   - Adds the teacher to the real-time staff ledger and broadcasts updates across all administrative terminals.
   - **Note:** The app does not currently send activation emails automatically. Create the staff record here, then give the person their login credentials as described in `TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md` (accounts are provisioned via environment variables by the administrator).

---

## 5. Cloud Deployment (Render + Supabase)

The VCS portal is a Next.js application deployed via the Render blueprint in `render.yaml`:

1. Push the codebase to GitHub:
   ```bash
   git add .
   git commit -m "Deploy RCA VCS portal"
   git push origin main
   ```
2. In [Render](https://render.com), choose **New + → Blueprint** and connect the repository.
3. Set the environment variables when prompted (see `.env.example` for the full list):
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon-key]"
   SUPABASE_SERVICE_ROLE_KEY="[service-role-key]"
   AUTH_SESSION_SECRET="[generate-a-long-random-string]"
   AUTH_SUPER_ADMIN_USERNAME="dominic370"
   AUTH_SUPER_ADMIN_PASSWORD="[choose-a-strong-password]"
   ```
4. Click **Apply**. Render builds and serves the app over HTTPS.

Staff/tester accounts are created by adding more `AUTH_<ROLE>_USERNAME` / `AUTH_<ROLE>_PASSWORD` environment variables — see `src/lib/auth/accounts.ts` for the exact variable names.

---

## 6. Continuous Assessment (CA) Gradebook & Result Publishing

The terminal assessment formula enforces the 40:60 Continuous Assessment ratio:
$$\text{Terminal Total (100)} = \text{1st Test (10)} + \text{2nd Test (10)} + \text{Project (10)} + \text{Mid-Term (10)} + \text{Exam / CBT (60)}$$

1. **Continuous Assessment Input:** Open [`/operations/update-ca`](http://localhost:3000/operations/update-ca). Select the class level (e.g. `Pre-Play`, `Play`, `Nursery 1`, `Primary 1-5`, `SS 2A`) and enter marks.
2. **CBT Integration:** Scores from CBT online exams scale automatically into the 60-point exam column.
3. **Approval & Publication:** The Exam Officer navigates to [`/operations/publish-results`](http://localhost:3000/operations/publish-results), reviews class broadsheets, and toggles **"Publish Results to Parents & Students"**.

---

## 7. Current Security Posture & Limitations

What is actually in place today:

- **Server-side login:** Passwords are verified on the server and sessions are signed, HttpOnly cookies (`src/lib/auth/`). Unauthenticated visitors are redirected to `/login` by `src/proxy.ts`.
- **Database access control:** Student, staff, and invoice data is read and written only through the authenticated API routes (`/api/students`, `/api/staff`, `/api/invoices`). The browser no longer holds direct write access to these tables, and `supabase/harden-rls.sql` removes the old permissive "public read/write" policies.
- **Transport encryption:** HTTPS is provided by the hosting platform (Render) and Supabase.
- **Supabase-managed backups:** Supabase projects include automated backups on paid tiers.

Known limitations (do not claim these to parents, staff, or regulators):

- **No email/SMS sending:** Resend and Twilio are not integrated. Staff activation and result notifications must be communicated manually.
- **No payment gateway:** Fee invoices are tracked in the bursary module, but online payments are not processed.
- **No AI proctoring or audit-log retention:** The CBT module records exam scores and basic sync flags, but there is no camera/AI proctoring and no long-term anti-malpractice audit store.
- **Role checks on the client:** Route and action permissions are enforced in the UI; a technically skilled user could bypass client-side checks, which is why the data APIs above are the real boundary.
- **"Realtime" sync is per-browser:** Cross-user live updates use `BroadcastChannel` (same browser only), not server push.

*Manual verified by: Dominic Mark (`dominic370`), Royal Crown Academy ICT Directorate.*
