-- ==============================================================================
-- ROYAL CROWN ACADEMY & HIGH SCHOOL
-- COMPLETE DATABASE SCHEMA COLUMN SYNCHRONIZATION
-- Additive Migration (Expand-and-Contract Pattern)
-- Safe to re-run: all statements use ADD COLUMN IF NOT EXISTS and safe defaults.
-- Ends with schema cache reload for Supabase PostgREST.
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Staff Table Columns Sync
-- Extracts and synchronizes every exact column key referenced across
-- src/app/api/staff, src/app/api/staff/[id], Staff Profile Dossier, and Realtime store.
ALTER TABLE public.staff
    ADD COLUMN IF NOT EXISTS staff_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS username VARCHAR(100),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NOT NULL DEFAULT '08030000000',
    ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'TEACHER',
    ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NOT NULL DEFAULT 'Male',
    ADD COLUMN IF NOT EXISTS assigned_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS assigned_class VARCHAR(100) NOT NULL DEFAULT 'Primary 1',
    ADD COLUMN IF NOT EXISTS class_id UUID,
    ADD COLUMN IF NOT EXISTS section_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS is_form_master BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NOT NULL DEFAULT 'Teacher',
    ADD COLUMN IF NOT EXISTS standing_duties JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS school_brand VARCHAR(80) NOT NULL DEFAULT 'Royal Crown Academy',
    ADD COLUMN IF NOT EXISTS staff_type VARCHAR(30) NOT NULL DEFAULT 'Teaching',
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS employment_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS qualifications TEXT NOT NULL DEFAULT 'B.Ed / B.Sc',
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS account_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS salary_grade VARCHAR(50) NOT NULL DEFAULT 'Level 1',
    ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) NOT NULL DEFAULT 'Nigerian',
    ADD COLUMN IF NOT EXISTS state_of_origin VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Staff Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_staff_staff_id ON public.staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_username ON public.staff(username);
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_staff_type ON public.staff(staff_type);
CREATE INDEX IF NOT EXISTS idx_staff_school_brand ON public.staff(school_brand);
CREATE INDEX IF NOT EXISTS idx_staff_class_id ON public.staff(class_id);
CREATE INDEX IF NOT EXISTS idx_staff_assigned_class ON public.staff(assigned_class);

-- 3. Students Table Columns Sync
-- Extracts and synchronizes every exact column key referenced across
-- src/app/api/students, src/app/api/students/[id], Student Profile Dossier, and Realtime store.
ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS admission_no VARCHAR(100),
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NOT NULL DEFAULT 'Male',
    ADD COLUMN IF NOT EXISTS class_name VARCHAR(100) NOT NULL DEFAULT 'Primary 1',
    ADD COLUMN IF NOT EXISTS house VARCHAR(100) NOT NULL DEFAULT 'Sapphire (Blue)',
    ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS guardian_address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(50) NOT NULL DEFAULT 'Parent',
    ADD COLUMN IF NOT EXISTS fee_status VARCHAR(50) NOT NULL DEFAULT 'Outstanding',
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS school_brand VARCHAR(80) NOT NULL DEFAULT 'Royal Crown Academy',
    ADD COLUMN IF NOT EXISTS section VARCHAR(40) NOT NULL DEFAULT 'PRIMARY',
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS medical_notes TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS allergies TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS admission_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) NOT NULL DEFAULT 'Nigerian',
    ADD COLUMN IF NOT EXISTS state_of_origin VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS lga VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS religion VARCHAR(60) NOT NULL DEFAULT 'Christianity',
    ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Student Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_students_adm ON public.students(admission_no);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_section ON public.students(section);
CREATE INDEX IF NOT EXISTS idx_students_school_brand ON public.students(school_brand);
CREATE INDEX IF NOT EXISTS idx_students_fee_status ON public.students(fee_status);

-- 4. Reload PostgREST Schema Cache
-- Instructs PostgREST to immediately refresh its in-memory schema table definitions,
-- preventing PGRST204 column-not-found errors on active connections.
NOTIFY pgrst, 'reload schema';
