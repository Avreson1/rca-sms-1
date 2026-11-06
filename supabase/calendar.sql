-- ==============================================================================
-- ROYAL CROWN ACADEMY — THE TERM CALENDAR AND THE ACTIVITY TEMPLATES
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql, operations_state.sql,
-- traits_assessments.sql, inventory.sql, timetable.sql, staff_duties.sql and
-- classes_and_subjects.sql. It is safe to run again: a table is created only
-- when absent, so nothing already filed is touched.
--
-- WHY THIS EXISTS AT ALL.
--
-- Both lists were typed into one browser and kept in that browser's
-- localStorage, under keys nobody else could read. A milestone is not
-- decoration: families are told when to send a child with a uniform, staff
-- mark the deadline for score entry, and the End of Term screen works out
-- whether a term has run its course. Yet the office's machine was the only one
-- holding the dates, and every other machine — the teacher's laptop, the
-- bursar's, a browser after a cache clear — showed an empty calendar and had no
-- way to know whether the term genuinely had no plans or whether this person
-- simply had not typed any.
--
-- WHAT THIS SCHEMA DELIBERATELY DOES NOT DO.
--
-- It does not invent a term's schedule. There is no seed row here, because the
-- seven milestones the screen used to offer to "Populate" — and the six activity
-- templates with their ₦450,000 budgets, their venues and their named
-- coordinators — were written by whoever built the portal, not decided by this
-- school. They arrive now only when somebody presses the button that says they
-- are a starting outline, and every one of them lands undated. A date is the
-- school's to fix.
--
-- It does not store a start date as a real date column. The school's own
-- wording is a span — "Nov 18 - 20, 2025", "Resumption week" — and a portal
-- that silently turned one into a single day would be printing a plan the
-- office did not make. `date_range` is therefore text, and an empty one means
-- the date has not been fixed yet, which the screens say in those words.
--
-- It does not tie an event to a class arm. The calendar has never had an arm
-- column; a milestone here is a whole-school one. Per-arm tests live on the
-- timetable and the CA grid, which already name their arm.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- THE MILESTONES
--
-- `session` and `term` label the row, and the label comes from what the school
-- says it is currently doing — not from the year compiled into the bundle, which
-- is how a school that moved into a new session kept filing its plan under the
-- old one.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session VARCHAR(20) NOT NULL,
    term VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    -- Empty is a real state, not a missing value: "the date is not fixed yet".
    -- What is not allowed is a date nobody typed, which is what "TBD" used to be.
    date_range VARCHAR(120) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(24) NOT NULL DEFAULT 'Academic',
    status VARCHAR(12) NOT NULL DEFAULT 'Upcoming',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT school_calendar_title_is_written CHECK (char_length(btrim(title)) >= 3),
    -- One milestone per title per term. The screen has no arm or subject column,
    -- so a second "Mid-Term Break" in the same term would be two rows nothing
    -- can tell apart — and it is far more likely to be the same button pressed
    -- twice than a fact about the school.
    CONSTRAINT school_calendar_one_milestone_per_title
        UNIQUE (session, term, title),
    CONSTRAINT school_calendar_term_is_a_known_term CHECK (
        term IN ('First Term', 'Second Term', 'Third Term')
    ),
    -- The first four are what the Add Milestone form offers. The last four only
    -- arrive when an activity template of that kind is scheduled into the term,
    -- and they are kept: a sports day filed as "Academic" is a lie the printed
    -- circular would carry.
    CONSTRAINT school_calendar_category_is_known CHECK (
        category IN ('Academic', 'Examination', 'Holiday', 'Administrative',
                     'Sports', 'Cultural', 'Excursion', 'Club')
    ),
    CONSTRAINT school_calendar_status_is_known CHECK (
        status IN ('Upcoming', 'Current', 'Completed')
    )
);

CREATE INDEX IF NOT EXISTS idx_school_calendar_period
    ON public.school_calendar_events(session, term);

COMMENT ON TABLE public.school_calendar_events IS
  'The school''s term milestones, labelled with the session and term they belong to. An empty date_range means the date has not been fixed, never that it has passed.';

-- ------------------------------------------------------------------------------
-- THE ACTIVITY TEMPLATES
--
-- A blueprint the office reuses: what the event is, who leads it, where, what it
-- costs, how long it runs. Scheduling one into a term copies these words into a
-- milestone, so they are stored as the school wrote them and not resolved into
-- ids — a template that names a coordinator who has left still says who ran it
-- the year the plan was made.
--
-- No row is seeded. The six templates the portal used to ship — an inter-house
-- championship at ₦450,000, a robotics expo at ₦350,000, a cultural festival at
-- ₦280,000, an industrial tour at ₦520,000, a career symposium and a PTA
-- assembly, each with a named coordinator and a venue — were invented by whoever
-- built the software. A school that never held any of them was shown a list of
-- events and budgets it had never approved, with a button that overwrote its own
-- list with them.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(24) NOT NULL DEFAULT 'Sports',
    -- Every one of these is allowed to be empty, and empty is printed as "not
    -- said". Filling a gap with "Unassigned", "Main Campus Hall" or "₦0" used to
    -- turn a blank into a decision the school never made — and ₦0 in particular
    -- reads as an approved free event, not as an unfilled box.
    target_section VARCHAR(160) NOT NULL DEFAULT '',
    coordinator VARCHAR(255) NOT NULL DEFAULT '',
    venue VARCHAR(255) NOT NULL DEFAULT '',
    budget VARCHAR(60) NOT NULL DEFAULT '',
    objectives TEXT NOT NULL DEFAULT '',
    duration_days INT NOT NULL DEFAULT 1 CHECK (duration_days >= 1 AND duration_days <= 30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT activity_templates_title_is_written CHECK (char_length(btrim(title)) >= 3),
    CONSTRAINT activity_templates_one_blueprint_per_title UNIQUE (title),
    CONSTRAINT activity_templates_category_is_known CHECK (
        category IN ('Academic', 'Sports', 'Cultural', 'Excursion', 'Administrative', 'Club')
    )
);

COMMENT ON TABLE public.activity_templates IS
  'Reusable activity blueprints the school wrote for itself. A blank field is a blank field: nothing here is filled in on the school''s behalf.';

-- ------------------------------------------------------------------------------
-- Row security, then the grants.
--
-- RLS is enabled with no policies, so the anon key a browser holds reads nothing
-- at all; every calendar call goes through the portal's own routes with the
-- service-role key. The grants belong to the role, not to the key string, so
-- rotating an API key needs none of this re-run.
-- ------------------------------------------------------------------------------
ALTER TABLE public.school_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_templates ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_calendar_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_templates TO service_role;

REVOKE ALL ON public.school_calendar_events FROM anon, authenticated;
REVOKE ALL ON public.activity_templates FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- Check the paste worked. Two rows, each reading true in can_read.
-- ------------------------------------------------------------------------------
SELECT c.relname,
       has_table_privilege('service_role', c.relname, 'SELECT') AS can_read,
       has_table_privilege('service_role', c.relname, 'INSERT') AS can_write
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('school_calendar_events', 'activity_templates')
ORDER BY c.relname;

-- ==============================================================================
-- Then prove it on two machines: file one milestone on the first, and reload the
-- second. The same row must appear, with the same session and term label on it.
-- If it does not, the grants above were not applied.
--
-- Both tables are revoked from every browser key, so nothing here is readable
-- without signing in. /api/calendar and /api/activity-templates serve the two
-- roles that may open the calendar screen — super admin and exam officer — plus
-- the QA login for reading; the setup prefix is denied to teachers, bursars and
-- families today, so a family checking term dates still works from the printed
-- circular. When a family-facing calendar is built, the read lists in those two
-- routes are the lines that widen.
-- ==============================================================================
