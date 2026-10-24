-- ==============================================================================
-- ROYAL CROWN ACADEMY - SUPABASE POSTGRESQL DATABASE SCHEMA
-- School: Royal Crown Academy (Rayfield, Jos, Plateau State)
-- Design: Serverless, Multi-Tier RBAC, Real-Time Subscriptions, Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ENUMS & TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role_tier AS ENUM ('SUPER_ADMIN', 'EXAM_OFFICER', 'TEACHER', 'STUDENT_PARENT', 'ACCOUNTANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE fee_payment_status AS ENUM ('Fully Cleared', 'Partially Paid', 'Outstanding');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gender_type AS ENUM ('Male', 'Female');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SCHOOL PROFILES & STAFF (Linked to 4-Step RBAC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '08030000000',
    role user_role_tier NOT NULL DEFAULT 'TEACHER',
    assigned_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
    assigned_class VARCHAR(100) NOT NULL DEFAULT 'Primary 1',
    is_form_master BOOLEAN NOT NULL DEFAULT false,
    email_verified BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. STUDENTS & ENROLLMENT (Pre-Play to Primary 5 & Secondary)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admission_no VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    gender gender_type NOT NULL DEFAULT 'Male',
    class_name VARCHAR(100) NOT NULL,
    house VARCHAR(100) NOT NULL DEFAULT 'Sapphire (Blue)',
    guardian_name VARCHAR(255),
    guardian_phone VARCHAR(50),
    fee_status fee_payment_status NOT NULL DEFAULT 'Outstanding',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast classroom filtering and broadsheet queries
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_students_adm ON public.students(admission_no);

-- ------------------------------------------------------------------------------
-- 4. CONTINUOUS ASSESSMENT (CA) & EXAMINATION GRADES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ca_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    session VARCHAR(50) NOT NULL DEFAULT '2025/2026',
    term VARCHAR(50) NOT NULL DEFAULT 'First Term',
    test1 NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (test1 >= 0 AND test1 <= 10),
    test2 NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (test2 >= 0 AND test2 <= 10),
    project NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (project >= 0 AND project <= 10),
    mid_term NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (mid_term >= 0 AND mid_term <= 10),
    exam NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (exam >= 0 AND exam <= 60),
    total_score NUMERIC(5, 2) GENERATED ALWAYS AS (test1 + test2 + project + mid_term + exam) STORED,
    tier_grade VARCHAR(10) NOT NULL DEFAULT 'F',
    remark VARCHAR(100) NOT NULL DEFAULT 'Fair',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, subject, session, term)
);

CREATE INDEX IF NOT EXISTS idx_ca_student ON public.ca_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_ca_subject ON public.ca_scores(subject);

-- ------------------------------------------------------------------------------
-- 5. ADJUSTABLE MULTI-TIER GRADING SCALES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.grading_tiers (
    id VARCHAR(50) PRIMARY KEY, -- PRE_PLAY_PLAY, NURSERY, PRIMARY, SECONDARY
    tier_title VARCHAR(255) NOT NULL,
    description TEXT,
    applicable_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
    brackets JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. COMPUTER-BASED TESTING (CBT) QUESTION BANK & PROCTORED SESSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cbt_questions (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer_index INT NOT NULL CHECK (correct_answer_index >= 0 AND correct_answer_index <= 5),
    marks INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cbt_exam_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    cbt_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    max_marks NUMERIC(5, 2) NOT NULL DEFAULT 60,
    strikes INT NOT NULL DEFAULT 0,
    is_expelled BOOLEAN NOT NULL DEFAULT false,
    malpractice_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    synced_to_ca BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. BURSARY & INVOICING
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_no VARCHAR(100) UNIQUE NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL,
    admission_no VARCHAR(100) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    session VARCHAR(50) NOT NULL DEFAULT '2025/2026',
    term VARCHAR(50) NOT NULL DEFAULT 'First Term',
    amount_billed NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
    last_payment_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ref VARCHAR(100) UNIQUE NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    student_name VARCHAR(255) NOT NULL,
    admission_no VARCHAR(100) NOT NULL,
    fee_type VARCHAR(100) NOT NULL DEFAULT 'Tuition Fee',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_channel VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
    status VARCHAR(50) NOT NULL DEFAULT 'Confirmed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. AUDIT LOGS & INMAIL
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inmail_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id VARCHAR(100) NOT NULL,
    sender_name VARCHAR(255) NOT NULL,
    recipient_id VARCHAR(100) NOT NULL,
    recipient_name VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. AUTH LINKAGE, ROW LEVEL SECURITY (RLS) & POLICIES
--    Same content as migrations/20261023000000_secure_auth_rls.sql
-- ------------------------------------------------------------------------------
-- ==============================================================================

-- 1. Link database records to Supabase Auth users ------------------------------
ALTER TABLE public.staff
    ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_portal_user ON public.students(portal_user_id);

-- 2. Keep academic/financial history when a student record is removed ----------
ALTER TABLE public.ca_scores DROP CONSTRAINT IF EXISTS ca_scores_student_id_fkey;
ALTER TABLE public.ca_scores ADD CONSTRAINT ca_scores_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
ALTER TABLE public.cbt_exam_sessions DROP CONSTRAINT IF EXISTS cbt_exam_sessions_student_id_fkey;
ALTER TABLE public.cbt_exam_sessions ADD CONSTRAINT cbt_exam_sessions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_student_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;

-- CBT attempts with repeated focus/fullscreen violations go to a teacher instead of an automatic zero.
ALTER TABLE public.cbt_exam_sessions
    ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;

-- 3. Role helpers (SECURITY DEFINER so policies on staff/students don't recurse) -
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT s.role::text FROM public.staff s
          WHERE s.auth_user_id = auth.uid() AND s.status = 'Active' LIMIT 1),
        (SELECT 'STUDENT_PARENT' FROM public.students st
          WHERE st.portal_user_id = auth.uid() LIMIT 1)
    );
$$;

CREATE OR REPLACE FUNCTION public.has_app_role(VARIADIC roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT COALESCE(public.current_app_role() = ANY(roles), false);
$$;

CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'TEACHER', 'ACCOUNTANT');
$$;

CREATE OR REPLACE FUNCTION public.owns_student(target UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (SELECT 1 FROM public.students WHERE id = target AND portal_user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_app_role(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_student(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_app_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_student(UUID) TO authenticated;

-- Teachers may only enter scores for their own form class or the subjects assigned to them.
CREATE OR REPLACE FUNCTION public.can_enter_score(target_student UUID, target_subject text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER')
        OR EXISTS (
            SELECT 1 FROM public.staff s
            JOIN public.students st ON st.id = target_student
            WHERE s.auth_user_id = auth.uid() AND s.status = 'Active' AND s.role = 'TEACHER'
              AND (st.class_name = s.assigned_class OR s.assigned_subjects ? target_subject)
        );
$$;
REVOKE ALL ON FUNCTION public.can_enter_score(UUID, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_enter_score(UUID, text) TO authenticated;

-- 4. Drop every existing policy on the application tables -----------------------
DO $$
DECLARE pol record;
BEGIN
    FOR pol IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public' AND tablename IN (
            'staff', 'students', 'ca_scores', 'grading_tiers', 'cbt_questions', 'cbt_exam_sessions',
            'invoices', 'transactions', 'audit_logs', 'inmail_messages')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inmail_messages ENABLE ROW LEVEL SECURITY;

-- 5. Role-based policies. No policy grants anything to the anon role. -----------
-- staff: every staff member can see the directory; only Super Admin can change it.
CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated
    USING (public.is_staff_member() OR auth_user_id = auth.uid());
CREATE POLICY staff_insert ON public.staff FOR INSERT TO authenticated
    WITH CHECK (public.has_app_role('SUPER_ADMIN'));
CREATE POLICY staff_update ON public.staff FOR UPDATE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN')) WITH CHECK (public.has_app_role('SUPER_ADMIN'));
CREATE POLICY staff_delete ON public.staff FOR DELETE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN'));

-- students: staff read all, a student/parent account reads only its linked record(s).
CREATE POLICY students_select ON public.students FOR SELECT TO authenticated
    USING (public.is_staff_member() OR portal_user_id = auth.uid());
CREATE POLICY students_insert ON public.students FOR INSERT TO authenticated
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER'));
CREATE POLICY students_update ON public.students FOR UPDATE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'ACCOUNTANT'))
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'ACCOUNTANT'));
CREATE POLICY students_delete ON public.students FOR DELETE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN'));

-- ca_scores: teachers / exam officers enter scores; students see their own.
CREATE POLICY ca_scores_select ON public.ca_scores FOR SELECT TO authenticated
    USING (public.is_staff_member() OR public.owns_student(student_id));
CREATE POLICY ca_scores_insert ON public.ca_scores FOR INSERT TO authenticated
    WITH CHECK (public.can_enter_score(student_id, subject));
CREATE POLICY ca_scores_update ON public.ca_scores FOR UPDATE TO authenticated
    USING (public.can_enter_score(student_id, subject))
    WITH CHECK (public.can_enter_score(student_id, subject));
CREATE POLICY ca_scores_delete ON public.ca_scores FOR DELETE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER'));

-- grading_tiers: readable by any signed-in user; editable by Super Admin / Exam Officer.
CREATE POLICY grading_tiers_select ON public.grading_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY grading_tiers_write ON public.grading_tiers FOR ALL TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER'))
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER'));

-- cbt_questions: staff only (the table holds the answer key).
CREATE POLICY cbt_questions_select ON public.cbt_questions FOR SELECT TO authenticated
    USING (public.is_staff_member());
CREATE POLICY cbt_questions_write ON public.cbt_questions FOR ALL TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'TEACHER'))
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'TEACHER'));

-- cbt_exam_sessions: students submit their own attempt; staff review.
CREATE POLICY cbt_sessions_select ON public.cbt_exam_sessions FOR SELECT TO authenticated
    USING (public.is_staff_member() OR public.owns_student(student_id));
-- Student attempts are inserted by the server (/api/cbt/attempts) with needs_review = true.
CREATE POLICY cbt_sessions_insert ON public.cbt_exam_sessions FOR INSERT TO authenticated
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'TEACHER'));
CREATE POLICY cbt_sessions_update ON public.cbt_exam_sessions FOR UPDATE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'TEACHER'))
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'EXAM_OFFICER', 'TEACHER'));
CREATE POLICY cbt_sessions_delete ON public.cbt_exam_sessions FOR DELETE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN'));

-- invoices / transactions: bursary staff manage; students see their own.
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT') OR public.owns_student(student_id));
CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT'));
CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT'))
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT'));
CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN'));

CREATE POLICY transactions_select ON public.transactions FOR SELECT TO authenticated
    USING (
        public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT')
        OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.owns_student(i.student_id))
    );
CREATE POLICY transactions_insert ON public.transactions FOR INSERT TO authenticated
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT'));
CREATE POLICY transactions_update ON public.transactions FOR UPDATE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT'))
    WITH CHECK (public.has_app_role('SUPER_ADMIN', 'ACCOUNTANT'));

-- audit_logs: append-only for staff, readable by Super Admin.
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT TO authenticated
    USING (public.has_app_role('SUPER_ADMIN'));
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (public.is_staff_member());

-- Audit entries always record the real signed-in staff member, whatever the client sends.
CREATE OR REPLACE FUNCTION public.stamp_audit_actor()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        SELECT s.full_name, s.role::text INTO NEW.actor_name, NEW.actor_role
          FROM public.staff s WHERE s.auth_user_id = auth.uid() LIMIT 1;
        IF NEW.actor_name IS NULL THEN
            RAISE EXCEPTION 'Audit log actor is not linked to a staff record';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_logs_stamp_actor ON public.audit_logs;
CREATE TRIGGER audit_logs_stamp_actor BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.stamp_audit_actor();

-- inmail: sender_id / recipient_id hold the Supabase Auth user id.
CREATE POLICY inmail_select ON public.inmail_messages FOR SELECT TO authenticated
    USING (sender_id = auth.uid()::text OR recipient_id = auth.uid()::text OR public.has_app_role('SUPER_ADMIN'));
CREATE POLICY inmail_insert ON public.inmail_messages FOR INSERT TO authenticated
    WITH CHECK (sender_id = auth.uid()::text AND public.current_app_role() IS NOT NULL);
CREATE POLICY inmail_update ON public.inmail_messages FOR UPDATE TO authenticated
    USING (recipient_id = auth.uid()::text) WITH CHECK (recipient_id = auth.uid()::text);
CREATE POLICY inmail_delete ON public.inmail_messages FOR DELETE TO authenticated
    USING (public.has_app_role('SUPER_ADMIN'));

-- ------------------------------------------------------------------------------
-- 10. REALTIME SUBSCRIPTION PUBLICATIONS
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ca_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cbt_exam_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.grading_tiers;
