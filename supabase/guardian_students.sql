-- ==============================================================================
-- ROYAL CROWN ACADEMY — GUARDIAN TO STUDENT LINKS
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql and
-- harden-rls.sql.
--
-- One row per (login, pupil) pair. This is what lets a Student / Parent sign in
-- and see exactly their own children: /api/students and /api/invoices look up
-- this table with the username from the signed session cookie and restrict the
-- rows they return. Nothing about the link is decided by the browser.
--
-- guardian_username  Matches app_accounts.username, and also the usernames of
--                    environment accounts (AUTH_STUDENT_PARENT_USERNAME). It is
--                    deliberately not a foreign key to app_accounts: an account
--                    that is deleted and re-created should not orphan a link the
--                    office typed in, and an environment login has no row here
--                    to point at.
-- admission_no       Matches students.admission_no, which is UNIQUE. Deleting a
--                    pupil cascades: the link goes with them.
--
-- A pupil may be linked to more than one login (mother and father), and one
-- login may be linked to several pupils (siblings). The uniqueness is on the
-- pair, not on either side.
--
-- Deliberately no RLS policies: RLS is enabled and no policy grants access, so
-- only the server (service-role key) reads this table. The browser's anon key
-- sees nothing.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.guardian_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guardian_username VARCHAR(100) NOT NULL,
    admission_no VARCHAR(100) NOT NULL REFERENCES public.students(admission_no) ON DELETE CASCADE,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guardian_students_pair_unique UNIQUE (guardian_username, admission_no)
);

ALTER TABLE public.guardian_students ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_guardian_students_guardian
    ON public.guardian_students(guardian_username);
CREATE INDEX IF NOT EXISTS idx_guardian_students_admission
    ON public.guardian_students(admission_no);

-- The app writes these for you: Settings → User Access links the pupils when a
-- Student / Parent account is created or edited. To do it by hand, replace the
-- two values below and run it once per child. The username must be lower case —
-- that is how the portal stores and compares logins.
--
-- INSERT INTO public.guardian_students (guardian_username, admission_no, created_by)
-- VALUES ('parent_rca', 'RCA/2025/001', 'dominic370')
-- ON CONFLICT (guardian_username, admission_no) DO NOTHING;
--
-- If CREATE TABLE fails with "referenced column "admission_no" must also be a
-- UNIQUE key", the pupils table has lost its unique constraint on admission
-- numbers. Say so rather than dropping the REFERENCES: without the foreign key,
-- a link to a pupil who is later deleted keeps pointing at a number no child
-- has, and a newly enrolled child given that number silently inherits it.
