-- ==============================================================================
-- ROYAL CROWN ACADEMY — THE TIMETABLE, ON THE SCHOOL'S RECORDS
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql, operations_state.sql,
-- traits_assessments.sql and inventory.sql. It is safe to run again.
--
-- Until now the timetable lived in one browser's localStorage. That means the
-- schedule a form teacher typed was not the schedule the office printed, the
-- workload figure was only ever as true as the last machine that opened the
-- screen, and clearing the browser's data lost a term's planning with no warning.
-- A timetable is the one document every adult in the school acts on, so it has to
-- have one home.
--
-- THE TWO RULES THIS SCHEMA ENFORCES:
--
-- 1. A slot holds one lesson. UNIQUE on (session, term, class_name, day,
--    period_index) is that rule written down: the same class cannot have two
--    Mathematics lessons filed in Period 3 on Tuesday, and re-saving a slot
--    updates it instead of stacking a second row that the grid then draws twice.
--
-- 2. A teacher is in one room at one time. The database cannot express that on
--    its own (the teacher is a name, and names are typed), so the API checks it
--    before every write and the screen refuses the clash. The rule lives in
--    src/lib/timetable/clashes.ts so the hand-built grid and the generated draft
--    are judged by the same one test — two different clash rules is how a
--    timetable ends up with the same teacher in two rooms.
--
-- session and term are on every row because a timetable is a term's document. The
-- portal used to keep one undated grid, so last term's schedule printed as this
-- term's and the "current" term was whatever the browser remembered.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- THE GRID: ONE ROW PER LESSON IN ONE SLOT
--
-- period_index is the slot number the school's own day structure uses (0 for the
-- first period, and so on). Breaks are not rows: they are part of the day's
-- structure, printed by the screen between the periods, and a break cannot be
-- "assigned to a teacher", so storing one as a lesson would put a row in the
-- workload count that nobody teaches.
--
-- period_label is kept as text rather than joined from a config table because the
-- label is what was on the printed card ("Period 1 (08:00 - 08:45 AM)"). Times may
-- move next term; a timetable filed this term keeps saying the times it was built
-- with, instead of silently relabelling itself when the office edits the day.
--
-- teacher_ref holds staff.staff_id when the school's staff file knows the person.
-- teacher_name is kept alongside it because a name is what a printed card shows a
-- parent, and because the school has always typed some of these before the staff
-- row existed. The workload matrix counts by ref when it has one and by name when
-- it has not — the same way it did when the grid was local — and says which it used.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session VARCHAR(20) NOT NULL,
    term VARCHAR(20) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    day VARCHAR(10) NOT NULL,
    period_index INT NOT NULL CHECK (period_index >= 0 AND period_index <= 11),
    period_label VARCHAR(80) NOT NULL DEFAULT '',
    subject VARCHAR(120) NOT NULL CHECK (char_length(btrim(subject)) >= 2),
    teacher_name VARCHAR(120) NOT NULL DEFAULT '',
    teacher_ref VARCHAR(40),
    room VARCHAR(80) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    CONSTRAINT timetable_entries_one_lesson_per_slot
        UNIQUE (session, term, class_name, day, period_index),
    CONSTRAINT timetable_entries_day_is_a_school_day CHECK (
        day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
    ),
    CONSTRAINT timetable_entries_term_is_a_known_term CHECK (
        term IN ('First Term', 'Second Term', 'Third Term')
    )
);

-- The grid for one class in one term, and every lesson one teacher is holding.
CREATE INDEX IF NOT EXISTS idx_timetable_entries_class
    ON public.timetable_entries(session, term, class_name, day, period_index);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_teacher
    ON public.timetable_entries(session, term, teacher_name);

ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- THE DAY'S STRUCTURE: HOW MANY PERIODS, WHICH DAYS, WHAT TIMES
--
-- The generator needs to know what a school day is before it can fill one. This
-- is one row per session and term — the shape of that term's day — because six
-- periods of 45 minutes and five days was a constant compiled into the portal, so
-- a school that runs seven periods or a four-day week could not say so without a
-- rebuild. A term that has no row here is not an error: the screen falls back to
-- the shape the portal has always printed and says plainly that it is doing that.
--
-- The seed inserts one term (2026/2027, First Term) in the shape the portal has
-- always used, and only when the school has no row at all, so a re-run never
-- overwrites an edited day.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.timetable_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session VARCHAR(20) NOT NULL,
    term VARCHAR(20) NOT NULL,
    -- JSON array of {"index":0,"label":"Period 1 (08:00 - 08:45 AM)"}. Breaks are
    -- listed here and carry a negative index, so they sort into place in the
    -- printed day without ever being a slot a lesson can be filed into.
    periods JSONB NOT NULL DEFAULT '[]'::jsonb,
    days JSONB NOT NULL DEFAULT '["Monday","Tuesday","Wednesday","Thursday","Friday"]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100) NOT NULL DEFAULT '',
    CONSTRAINT timetable_periods_one_shape_per_term
        UNIQUE (session, term),
    CONSTRAINT timetable_periods_term_is_a_known_term CHECK (
        term IN ('First Term', 'Second Term', 'Third Term')
    )
);

ALTER TABLE public.timetable_periods ENABLE ROW LEVEL SECURITY;

INSERT INTO public.timetable_periods (session, term, periods, days, updated_by)
SELECT '2026/2027', 'First Term', jsonb_build_array(
    jsonb_build_object('index', 0,  'label', 'Period 1 (08:00 - 08:45 AM)'),
    jsonb_build_object('index', 1,  'label', 'Period 2 (08:45 - 09:30 AM)'),
    jsonb_build_object('index', -1, 'label', 'Short Break (09:30 - 10:00 AM)', 'is_break', true),
    jsonb_build_object('index', 2,  'label', 'Period 3 (10:00 - 10:45 AM)'),
    jsonb_build_object('index', 3,  'label', 'Period 4 (10:45 - 11:30 AM)'),
    jsonb_build_object('index', -2, 'label', 'Long Break & Lunch (11:30 - 12:15 PM)', 'is_break', true),
    jsonb_build_object('index', 4,  'label', 'Period 5 (12:15 - 01:00 PM)'),
    jsonb_build_object('index', 5,  'label', 'Period 6 (01:00 - 01:45 PM)')
), jsonb_build_array('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'), 'source: migration'
WHERE NOT EXISTS (
    SELECT 1 FROM public.timetable_periods WHERE session = '2026/2027' AND term = 'First Term'
);

-- ------------------------------------------------------------------------------
-- Grants. Service-role traffic bypasses row security, but a table still has to be
-- granted to the role that touches it. The grants follow the role, so rotating an
-- API key needs none of this re-run.
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_entries TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.timetable_periods TO service_role;

REVOKE ALL ON public.timetable_entries FROM anon, authenticated;
REVOKE ALL ON public.timetable_periods FROM anon, authenticated;

-- ==============================================================================
-- Check it worked:
--
--   SELECT count(*) FROM public.timetable_entries;   -- 0 until a slot is filed
--   SELECT jsonb_array_length(periods) FROM public.timetable_periods WHERE id = 1;   -- 8
--
-- Then file one lesson and read it back from a second browser. The same row must
-- appear. If it does not, the grants above were not applied.
--
-- A family has no reason to see the school's staffing grid, and a bursar has none
-- either: both tables are revoked from every browser key, and /api/timetable
-- answers to the roles that build it.
-- ==============================================================================
