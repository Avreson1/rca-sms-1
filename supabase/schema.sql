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
-- 9. ROW LEVEL SECURITY (RLS) & POLICIES
-- ------------------------------------------------------------------------------
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

-- The browser only needs read access to reference data. Every other table is
-- reached through the authenticated API routes, which use the service-role key
-- (service role bypasses RLS). For an existing database run supabase/harden-rls.sql.
CREATE POLICY "Public read grading tiers" ON public.grading_tiers
    FOR SELECT TO anon, authenticated USING (true);

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
