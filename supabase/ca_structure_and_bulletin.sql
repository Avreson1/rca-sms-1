-- ==============================================================================
-- ROYAL CROWN ACADEMY — THE CA COMPONENT STRUCTURE, THE CARD THEME AND THE
-- TERMINAL NEWSLETTER
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql, operations_state.sql,
-- traits_assessments.sql, inventory.sql, timetable.sql, staff_duties.sql,
-- classes_and_subjects.sql, cbt.sql and calendar.sql. It is safe to run again:
-- a table is created only when absent, so nothing already filed is touched.
--
-- WHY THIS EXISTS AT ALL.
--
-- These were the last three lists the portal kept in one browser's
-- localStorage. Two of them decide what a family receives:
--
--   * The terminal newsletter — the Principal's address, the resumption date,
--     the key events, the fee deadline and the school's bank details — is
--     printed onto the back of every child's report card. Whoever typed it on
--     the office machine was the only person in the school whose cards carried
--     it, and clearing that browser deleted the circular along with the cache.
--     Worse, the printed sheet is labelled with the session and term being
--     printed, so a card printed for Third Term carried the words written for
--     First Term and nothing on the page said so.
--   * The report card theme is one standing choice, and it was one browser's
--     localStorage value.
--   * The CA component structure is the school's statement of how a tier is
--     assessed. It was compiled into the portal as four invented mark-up
--     distributions, editable in one browser only.
--
-- WHAT THIS SCHEMA DELIBERATELY DOES NOT DO.
--
-- It does not change how a mark is computed. The gradebook (Operations → Update
-- CA) and /api/ca still add 10 + 10 + 10 + 10 + 60 because those five boxes and
-- their ceilings are written into that code. What is filed here is what the
-- school says its assessment is made of; making the entry screen and the
-- arithmetic obey it is a separate piece of work, and the CA screen says this in
-- those words rather than implying that filing a structure re-grades anybody.
--
-- It does not seed anything. The four structures the portal shipped — with
-- their "Week 3 early assessment in literacy and numeracy" and "Post-midterm
-- assessment" descriptions — were written by whoever built the software, not by
-- this school. They are offered by a button on the screen that calls them a
-- starting outline, and they reach these tables only when somebody presses it.
--
-- It does not store a total, a weight or an id per component. `total_max_score`
-- was always the sum of the parts and could disagree with them; `weight` was
-- never read by any screen and always equalled `max_score`. Derived data is not
-- stored here, in the same way `ca_scores.total_score` is computed rather than
-- typed.
--
-- It does not invent a newsletter. Every field but the session and term is
-- allowed to be blank, a term with no row has no circular, and the card prints
-- "No newsletter has been filed for this term" instead of last term's message
-- under this term's heading. In particular nothing here holds a bank account: a
-- printed account number sends families money, so it is typed by the bursary and
-- never guessed.
--
-- It does not store the tier's name or the classes in it. "Play & Preschool",
-- "Nursery 1 & 2" and which arm belongs to which tier are the portal's own
-- taxonomy — the same map the grading scales and the report card group by. Only
-- the list of components, and the school's note about it, belong on the record.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. WHAT A TIER'S CONTINUOUS ASSESSMENT IS MADE OF
--
-- One row per tier, and only for a tier somebody has actually filed. The
-- components are a JSON array of
-- { "key", "name", "max_score", "description" } in the order the school teaches
-- them, which is the shape the screen edits and the order a teacher reads down a
-- mark sheet.
--
-- The per-entry rules — a name, a key that is a plain identifier, a max_score
-- that is a whole number of marks between 1 and 100, between 1 and 12 entries —
-- are enforced in /api/ca-structures, because there a person is told which
-- component was refused and why. Postgres can only fail the row, which would
-- leave the screen reporting a database error for what is a typing mistake.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ca_component_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_key VARCHAR(24) NOT NULL,
    components JSONB NOT NULL,
    -- The school's own sentence about how this tier is assessed. It prints under
    -- the tier's name in place of the compiled-in one, so the screen cannot
    -- describe a five-part CA with the words "4-Part Continuous Assessment".
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT ca_structure_tier_is_known CHECK (
        tier_key IN ('PLAY_PRESCHOOL', 'NURSERY', 'PRIMARY', 'SECONDARY')
    ),
    -- The natural key: a tier has one structure, and the screen edits the whole
    -- list at once rather than one component at a time.
    CONSTRAINT ca_structure_one_row_per_tier UNIQUE (tier_key),
    CONSTRAINT ca_structure_components_are_a_list CHECK (
        jsonb_typeof(components) = 'array'
        AND jsonb_array_length(components) BETWEEN 1 AND 12
    ),
    CONSTRAINT ca_structure_description_is_short CHECK (char_length(description) <= 4000)
);

COMMENT ON TABLE public.ca_component_structures IS
  'What the school says each tier''s assessment is made of. One row per tier, filed deliberately; a tier with no row has no filed structure, which is not the same as a structure of zero components.';

-- ------------------------------------------------------------------------------
-- 2. THE REPORT CARD THEME
--
-- One row. `id = 1` is the same shape the switch that opens the exam portal and
-- the trait rubric use: there is exactly one of these in a school, and a second
-- row would mean two answers to "what do our cards look like".
--
-- Deliberately absent: the per-card section toggles on the score-card screen
-- (behaviour panel, attendance block, whether the circular is attached). Those
-- are choices about a print run, made at the moment of printing, not the
-- school's standing configuration.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_card_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    theme_key VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT report_card_settings_is_the_one_row CHECK (id = 1),
    -- The six ids the theme picker offers. A typo here would make every card
    -- fall back to the built-in scheme while the screen claimed otherwise.
    CONSTRAINT report_card_theme_is_known CHECK (
        theme_key IN ('royal', 'scheme2', 'emerald', 'burgundy', 'gold', 'slate')
    )
);

COMMENT ON TABLE public.report_card_settings IS
  'The report card colour scheme the school chose. One row; the score-card screen opens with it and a print run may be previewed in another scheme without changing this.';

-- ------------------------------------------------------------------------------
-- 3. THE TERMINAL NEWSLETTER — ONE PER SESSION AND TERM
--
-- A row is keyed by the session and term it was written for, because the card
-- prints it under that heading. One shared bulletin could only ever be correct
-- for one term, and for the other two it printed the wrong resumption date, the
-- wrong fee deadline and the wrong events under a term label that did not match.
--
-- Every text column is NOT NULL DEFAULT '' and blank is kept blank: the screen
-- that prints the circular says "not written for this term" or "Resumption date
-- not announced" for an empty field, and prints nothing at all when the school
-- has entered no bank details.
--
-- `events_and_highlights` is a JSON array of one-line strings — the shape the
-- editor takes one line per event and the card prints as bullets.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terminal_newsletters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session VARCHAR(20) NOT NULL,
    term VARCHAR(20) NOT NULL,
    title VARCHAR(160) NOT NULL DEFAULT '',
    principal_name VARCHAR(160) NOT NULL DEFAULT '',
    principal_message TEXT NOT NULL DEFAULT '',
    next_term_resumption VARCHAR(160) NOT NULL DEFAULT '',
    events_and_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
    fee_policy_and_deadlines TEXT NOT NULL DEFAULT '',
    bank_name VARCHAR(120) NOT NULL DEFAULT '',
    account_name VARCHAR(160) NOT NULL DEFAULT '',
    -- Printed on a sheet that goes home to every family in the school, which is
    -- why nothing here is seeded and why the length is bounded rather than free.
    account_number VARCHAR(60) NOT NULL DEFAULT '',
    custom_notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    CONSTRAINT terminal_newsletters_one_bulletin_per_term
        UNIQUE (session, term),
    CONSTRAINT terminal_newsletters_term_is_a_known_term CHECK (
        term IN ('First Term', 'Second Term', 'Third Term')
    ),
    CONSTRAINT terminal_newsletters_events_are_a_list CHECK (
        jsonb_typeof(events_and_highlights) = 'array'
        AND jsonb_array_length(events_and_highlights) <= 40
    )
);

CREATE INDEX IF NOT EXISTS idx_terminal_newsletters_period
    ON public.terminal_newsletters(session, term);

COMMENT ON TABLE public.terminal_newsletters IS
  'The end-of-term circular the school wrote for one named session and term. A term with no row prints no circular, rather than another term''s words under this term''s heading.';

-- ------------------------------------------------------------------------------
-- Row security, then the grants.
--
-- RLS is enabled with no policies, so the anon key a browser holds reads nothing
-- at all; every call goes through the portal's own routes with the service-role
-- key. The grants belong to the role, not to the key string, so rotating an API
-- key needs none of this re-run.
-- ------------------------------------------------------------------------------
ALTER TABLE public.ca_component_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_card_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_newsletters ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ca_component_structures TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_card_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminal_newsletters TO service_role;

REVOKE ALL ON public.ca_component_structures FROM anon, authenticated;
REVOKE ALL ON public.report_card_settings FROM anon, authenticated;
REVOKE ALL ON public.terminal_newsletters FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- Check the paste worked. Three rows, each reading true in can_read and can_write.
-- ------------------------------------------------------------------------------
SELECT c.relname,
       has_table_privilege('service_role', c.relname, 'SELECT') AS can_read,
       has_table_privilege('service_role', c.relname, 'INSERT') AS can_write
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ca_component_structures', 'report_card_settings', 'terminal_newsletters')
ORDER BY c.relname;

-- ==============================================================================
-- Then prove it on two machines: file one tier's CA structure on the first, and
-- reload the second. The same components must appear. Then save the theme and the
-- current term's circular and read the score-card screen from the other machine.
-- If they do not, the grants above were not applied.
--
-- The read side is wide on purpose and narrow where it matters. /api/newsletter
-- and /api/report-theme answer every signed-in role, because the circular and the
-- card's colours reach a family through their own child's printed card, and the
-- score-card screen is where they appear. /api/ca-structures answers the two roles
-- that may open the CA screen plus the QA login, like the other setup tables —
-- a teacher marking a pupil works from the five columns the gradebook holds, not
-- from this list.
-- ==============================================================================
