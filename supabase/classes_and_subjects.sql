-- ==============================================================================
-- ROYAL CROWN ACADEMY — WHICH CLASSES THE SCHOOL RUNS AND WHAT THEY TEACH
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql, operations_state.sql,
-- traits_assessments.sql, inventory.sql, timetable.sql and staff_duties.sql.
-- It is safe to run again: a table is created only when absent and a column is
-- added only when missing, so nothing already filed is touched.
--
-- WHY THIS EXISTS AT ALL.
--
-- The class arms, the subject list and the subject packages were typed into one
-- browser and stored in that browser's localStorage. They are not decoration:
-- the CA grid filters by them, the timetable groups filed lessons by them, the
-- fee schedule prices per arm, promotion moves a child from one to another, and
-- the report card head groups by them. So a second machine — the teacher's own
-- laptop, the bursar's, a head office that wiped its cache — saw a class list
-- that was incomplete or empty, and every screen that groups by class was
-- quietly grouping by one person's cache.
--
-- Putting them on the school's records is also what makes a whole-term figure
-- defensible: an arm can now be named and counted the same way on every machine.
--
-- THREE THINGS THIS SCHEMA DELIBERATELY DOES NOT STORE.
--
-- 1. It does not store a pupil count on the arm. How many children are in JSS 1A
--    is answered by counting the pupils filed in the students table, not by a
--    number somebody typed once and never revised. The API computes it when it
--    reads the arms, so a screen can never print a figure nobody entered.
--
-- 2. It does not store how many teachers are assigned to a subject, for the same
--    reason.
--
-- 3. There is no foreign key from a subject to a class, and none from a package's
--    entries to the subjects table. Both are kept as names, on purpose. An arm is
--    retired every year; a subject list that once had "Computer Studies" in it
--    must still read the way it read when a child's report was written. Rows that
--    describe the past quote names; only rows that describe the present are safe
--    to point at.
--
-- A subject is unique per (name, level-band) rather than per name alone, because
-- "Mathematics" taught in Nursery and taught in SSS 3 are two different entries
-- on the two different grids the school publishes, and collapsing them would
-- silently merge two curricula into one row.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- THE CLASS ARMS
--
-- `name` is the key the rest of the portal quotes. Pupils, invoices, CA scores,
-- timetable lessons and promotion all address a class by its written name, so
-- the name is unique and it is not allowed to be blank or padded.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_arms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(60) NOT NULL,
    section VARCHAR(40) NOT NULL CHECK (
        section IN ('Creche & Playgroup', 'Nursery School', 'Basic Primary',
                    'Junior Secondary', 'Senior Secondary')
    ),
    -- The form master is quoted by name as well as by the register's staff
    -- number: the number is a pointer into a record that can be deleted, the
    -- name is what the class roll printed on the day.
    form_teacher VARCHAR(255) NOT NULL DEFAULT '',
    form_teacher_id VARCHAR(50) NOT NULL DEFAULT '',
    capacity INT NOT NULL DEFAULT 0 CHECK (capacity >= 0 AND capacity <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT class_arms_name_is_written CHECK (char_length(btrim(name)) >= 2),
    CONSTRAINT class_arms_one_row_per_name UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_class_arms_section ON public.class_arms(section);

COMMENT ON TABLE public.class_arms IS
  'The arms the school actually runs. The pupil count is never stored here: it is counted from public.students by class_name.';

-- ------------------------------------------------------------------------------
-- THE SUBJECT LIST
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    code VARCHAR(40) NOT NULL DEFAULT '',
    -- The band the subject belongs to, which is what the CA structure and the
    -- grading scale also key off. Left as free text with a length limit rather
    -- than a CHECK, because a school renames its bands more often than it
    -- renames a subject and a refused rename is not worth a lost term's list.
    category VARCHAR(60) NOT NULL DEFAULT '',
    applicable_classes JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_compulsory BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subjects_name_is_written CHECK (char_length(btrim(name)) >= 2),
    -- Two arms of the same band can share a subject; the same band cannot hold
    -- the same subject name twice, or the CA grid would offer the same line twice
    -- and file the marks against whichever row it happened to pick.
    CONSTRAINT subjects_one_row_per_name_and_band UNIQUE (name, category)
);

COMMENT ON COLUMN public.subjects.applicable_classes IS
  'JSON array of class arm names this subject is taught to. An empty array means every arm the school runs, present and future — naming the twelve arms one by one would leave a paper untaught in an arm opened next term. Names, not ids: an arm retired last year must still be readable on a report printed this year.';

-- ------------------------------------------------------------------------------
-- THE SUBJECT TEMPLATES
--
-- A template is the set of subjects one arm sits, saved once so the office does
-- not retype the same twenty lines for every new arm. `target_class` is the
-- tier's own words — "SS 1 - SS 3" names three arms, so it is text and not a
-- foreign key — and `subjects` is an array of names. No pupil count is kept
-- here: a template is a plan, not a register, and the children in a year group
-- are counted from the roll when somebody asks for them.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subject_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    department VARCHAR(40) NOT NULL CHECK (
        department IN ('Early Years', 'Nursery', 'Primary', 'Science', 'Arts',
                       'Commercial', 'General')
    ),
    target_class VARCHAR(60) NOT NULL DEFAULT '',
    subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subject_templates_name_is_written CHECK (char_length(btrim(name)) >= 2),
    CONSTRAINT subject_templates_one_row_per_name UNIQUE (name)
);

ALTER TABLE public.class_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_templates ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Grants. Service-role traffic bypasses row security, but a table still has to be
-- granted to the role that touches it. The grants follow the role, so rotating an
-- API key needs none of this re-run.
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_arms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_templates TO service_role;

REVOKE ALL ON public.class_arms FROM anon, authenticated;
REVOKE ALL ON public.subjects FROM anon, authenticated;
REVOKE ALL ON public.subject_templates FROM anon, authenticated;
