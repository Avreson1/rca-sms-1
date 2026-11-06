-- ==============================================================================
-- ROYAL CROWN ACADEMY — WHO DOES WHAT JOB, AND WHO IS ON DUTY TODAY
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql, operations_state.sql,
-- traits_assessments.sql, inventory.sql and timetable.sql. It is safe to run
-- again: the columns are added only when missing and the table is created only
-- when absent, so nothing already filed is touched.
--
-- TWO THINGS THE PORTAL COULD NOT SAY BEFORE THIS:
--
-- 1. WHAT JOB A PERSON HOLDS. `staff.role` is an access tier — it decides which
--    screens a login opens. It is not a designation. A school that calls someone
--    "Bursar", "Coordinator", "Dean of Studies" or "ICT Officer" had nowhere to
--    write that down, so the workspace greeted people as "Tier 3: Form / Subject
--    Teacher" whether or not that described the work they were actually hired for.
--    `designation` is the job title, kept separate from the tier on purpose: the
--    tier is what the portal enforces, the title is what the school states, and
--    letting one imply the other is how a person ends up with access nobody
--    decided to give them.
--
-- 2. WHO WAS ON DUTY. Assembly duty, gate duty, break-duty supervision — this is
--    run on paper or from memory, so a teacher who turned up to a duty they were
--    never told about has no record to point at, and the school has no record of
--    who it put there. `staff_duties` is one row per person per duty per time
--    window on one named date, with the login that filed it stored on the row.
--
-- A duty row snapshots the person's name and designation at the time it was
-- filed, and there is deliberately no foreign key to `staff`. A staff record can
-- be removed from the register, and when it is, the record of who was on gate
-- duty on a Tuesday in November must not disappear with it. The API checks the
-- staff number against the register before it files a duty, so a duty cannot be
-- assigned to a person who is not on file — and a duty that outlives its record
-- still says whose name it was filed under.
--
-- UNIQUE on (duty_date, staff_id, time_window) is the one rule the database
-- enforces: one person cannot hold two different duties in the same window of the
-- same day, and re-assigning the same window corrects the row instead of stacking
-- a second duty the roster then prints twice.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- THE STAFF RECORD GAINS ITS JOB TITLE AND ITS STANDING DUTIES
--
-- Standing duties are what a person is usually on — "Assembly duty, Mondays" —
-- as distinct from the dated assignments below. They are a list on the staff
-- record, edited by the office, and the roster screen offers them as suggestions
-- when a date is being filled. Nothing here copies them onto a date by itself.
-- ------------------------------------------------------------------------------
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS designation VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS standing_duties JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.staff.designation IS
  'The job title the school states, e.g. Bursar or Dean of Studies. Separate from staff.role, which is the access tier the portal enforces.';
COMMENT ON COLUMN public.staff.standing_duties IS
  'JSON array of duty names this person is ordinarily on, e.g. ["Assembly duty","Gate duty"]. Suggestions for the roster; never auto-assigned.';

-- ------------------------------------------------------------------------------
-- THE DUTY ROSTER: ONE ROW PER PERSON, PER DUTY, PER WINDOW, PER DATE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_duties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duty_date DATE NOT NULL,
    -- The register's own staff number (staff.staff_id), not the UUID, because it
    -- is what the office reads off a slip and what every other screen quotes.
    staff_id VARCHAR(50) NOT NULL,
    -- Snapshots, so the roster still names the person after their record goes.
    staff_name VARCHAR(255) NOT NULL,
    designation VARCHAR(80) NOT NULL DEFAULT '',
    duty VARCHAR(120) NOT NULL CHECK (char_length(btrim(duty)) >= 2),
    time_window VARCHAR(40) NOT NULL CHECK (
        time_window IN ('Before School', 'Morning Assembly', 'Break Time',
                        'Lunch Break', 'After School', 'All Day')
    ),
    location VARCHAR(120) NOT NULL DEFAULT '',
    notes VARCHAR(500) NOT NULL DEFAULT '',
    -- Whose login filed the duty. Taken from the signed session and never from
    -- the request body: when someone asks "who put me on this", the row answers.
    assigned_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT staff_duties_one_duty_per_window
        UNIQUE (duty_date, staff_id, time_window),
    -- A duty roster for the year 4000 is a typo, not a plan. Refused here so the
    -- screen cannot file one quietly.
    CONSTRAINT staff_duties_date_is_plausible CHECK (
        duty_date >= DATE '2020-01-01' AND duty_date <= DATE '2100-12-31'
    )
);

CREATE INDEX IF NOT EXISTS idx_staff_duties_date ON public.staff_duties(duty_date);
CREATE INDEX IF NOT EXISTS idx_staff_duties_person ON public.staff_duties(staff_id, duty_date);

ALTER TABLE public.staff_duties ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Grants. Service-role traffic bypasses row security, but a table still has to be
-- granted to the role that touches it. The grants follow the role, so rotating an
-- API key needs none of this re-run.
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_duties TO service_role;
-- The staff columns added above belong to a table the service role already holds.
GRANT UPDATE ON public.staff TO service_role;

REVOKE ALL ON public.staff_duties FROM anon, authenticated;
