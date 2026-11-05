-- ==============================================================================
-- ROYAL CROWN ACADEMY — CHARACTER, PSYCHOMOTOR AND ATTENDANCE ASSESSMENTS
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql, guardian_students.sql and operations_state.sql.
-- It is safe to run again.
--
-- This closes the last gap in a family's report card. The marks have a table and
-- were already read from the school's own records; the affective and psychomotor
-- ratings, the days present, the form teacher's remark and the principal's
-- endorsement lived only in one browser's localStorage
-- ("rca_psychomotor_store_v6"). So a parent opening the portal on a phone saw the
-- marks the exam office filed and *nothing else* — no behaviour rating, no
-- attendance, no remark — or, on the machine the form teacher had used, ratings
-- no other person on earth could see. The card a family collects and the card the
-- school prints were two different documents.
--
-- Like every table in this folder, it is read and written only through the
-- portal's API routes, which check the signed-in role first and, for a Student /
-- Parent, filter by the pupils linked in guardian_students. RLS is on with no
-- policies, so the browser's anon key can read none of it.
--
-- traits_assessments.student_id is supplied by the server, from the pupil's
-- admission number — the browser never chooses which child a row belongs to.
-- days_absent is a generated column, so no request can file 115 opened, 90
-- present and 40 absent on the same child.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. THE SCHOOL'S TRAIT LIST
--
-- The rubric the form teacher rates against. It used to be a list compiled into
-- the code plus whatever each machine's own browser had added, so Setup could
-- invent a trait on one laptop that no other screen would ever offer again. One
-- row, always id = 1, holding the school's list as JSON.
--
-- The seeded array is the fourteen traits the portal has always shipped
-- (src/lib/realtime-store.ts, DEFAULT_TRAITS) — not marks, not a child's data,
-- and the school can edit or remove any of them from Operations → Traits &
-- Psychomotor. The WHERE NOT EXISTS means re-running this file never overwrites
-- the list the school has since changed.
--
-- Built with jsonb_build_object rather than one long '[…]' string on purpose: the
-- first version of this file put all fourteen traits inside a single quoted
-- literal spanning sixteen lines, and a paste that lost the final ]'::jsonb came
-- back as "unterminated quoted string" with the whole script rolled back. One
-- short quoted value per line cannot fail that way.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.traits_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    traits JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100) NOT NULL DEFAULT ''
);

INSERT INTO public.traits_config (id, traits)
SELECT 1, jsonb_build_array(
    jsonb_build_object('id', 'tr-punc',  'name', 'Punctuality & Regularity',                'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Timeliness to morning assemblies, roll-call, and lectures.'),
    jsonb_build_object('id', 'tr-neat',  'name', 'Neatness & Uniform Compliance',           'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Personal hygiene, haircut, and school uniform compliance.'),
    jsonb_build_object('id', 'tr-hone',  'name', 'Honesty & Moral Integrity',               'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Trustworthiness, truthfulness, and character in interactions.'),
    jsonb_build_object('id', 'tr-poli',  'name', 'Politeness & Courteousness',              'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Respectful conduct towards teachers, elders, and visitors.'),
    jsonb_build_object('id', 'tr-lead',  'name', 'Leadership & Sense of Responsibility',    'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Initiative, prefect duties, and group project leadership.'),
    jsonb_build_object('id', 'tr-emot',  'name', 'Emotional Stability & Self-Control',      'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Maturity, anger management, and emotional composure.'),
    jsonb_build_object('id', 'tr-peer',  'name', 'Relationship with Peers',                 'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Cooperation, friendliness, and anti-bullying mindset.'),
    jsonb_build_object('id', 'tr-attent','name', 'Attentiveness & Class Participation',     'category', 'Affective (Behavioral)',        'scale', '1 - 5 Scale', 'description', 'Focus, active listening, and contributing in discussions.'),
    jsonb_build_object('id', 'tr-hand',  'name', 'Handwriting & Calligraphy',               'category', 'Psychomotor (Physical / Skill)','scale', '1 - 5 Scale', 'description', 'Legibility, neatness, and precision in written work.'),
    jsonb_build_object('id', 'tr-verb',  'name', 'Verbal Expression & Fluency',             'category', 'Psychomotor (Physical / Skill)','scale', '1 - 5 Scale', 'description', 'Clarity of speech, debates, and public presentation.'),
    jsonb_build_object('id', 'tr-spor',  'name', 'Sports & Physical Agility',               'category', 'Psychomotor (Physical / Skill)','scale', '1 - 5 Scale', 'description', 'Participation and coordination in inter-house sports and games.'),
    jsonb_build_object('id', 'tr-craf',  'name', 'Drawing, Crafts & Visual Arts',           'category', 'Psychomotor (Physical / Skill)','scale', '1 - 5 Scale', 'description', 'Creative illustrations, technical drawings, and craft projects.'),
    jsonb_build_object('id', 'tr-musi',  'name', 'Music, Rhythm & Performing Arts',         'category', 'Psychomotor (Physical / Skill)','scale', '1 - 5 Scale', 'description', 'Musical instrument performance, singing, and drama.'),
    jsonb_build_object('id', 'tr-lab',   'name', 'Laboratory & Workshop Dexterity',         'category', 'Psychomotor (Physical / Skill)','scale', '1 - 5 Scale', 'description', 'Handling scientific apparatus, computers, and practical tools.')
)
WHERE NOT EXISTS (SELECT 1 FROM public.traits_config WHERE id = 1);

ALTER TABLE public.traits_config ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. ONE ASSESSMENT PER PUPIL PER SESSION PER TERM
--
-- UNIQUE on (student_id, session, term): a child has one set of behaviour ratings
-- per term, and filing the same term twice updates it rather than stacking a
-- second card's worth of remarks underneath the first. Deleting the pupil takes
-- the assessment with them, the same way ca_scores does.
--
-- The rating columns are JSON objects of trait id -> 0..5, exactly the shape the
-- card prints. 0 means "this trait was not rated", which is what an unmarked
-- child's record holds — not a 4 invented for everybody.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.traits_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    session VARCHAR(50) NOT NULL,
    term VARCHAR(50) NOT NULL,
    affective_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
    psychomotor_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
    days_opened INT NOT NULL DEFAULT 0 CHECK (days_opened >= 0 AND days_opened <= 400),
    days_present INT NOT NULL DEFAULT 0 CHECK (days_present >= 0 AND days_present <= days_opened),
    days_absent INT GENERATED ALWAYS AS (days_opened - days_present) STORED,
    form_teacher_remark TEXT NOT NULL DEFAULT '',
    principal_remark TEXT NOT NULL DEFAULT '',
    next_term_begins VARCHAR(100) NOT NULL DEFAULT '',
    promoted_to VARCHAR(100) NOT NULL DEFAULT '',
    assessed_by VARCHAR(100) NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT traits_assessments_scope_unique UNIQUE (student_id, session, term)
);

CREATE INDEX IF NOT EXISTS idx_traits_assessments_session_term
    ON public.traits_assessments(session, term);
CREATE INDEX IF NOT EXISTS idx_traits_assessments_student
    ON public.traits_assessments(student_id);

ALTER TABLE public.traits_assessments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Grants. Service-role traffic bypasses row security, but a table still has to be
-- granted to the role that touches it; on a project created before these tables
-- existed the grants can be missing and the portal then reports "permission
-- denied for table …". The grants follow the role, so rotating a key needs none
-- of this re-run.
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traits_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traits_assessments TO service_role;

-- The browser's keys must go through /api/traits and /api/traits-config, where
-- the session's role and the guardian links decide what is handed back.
REVOKE ALL ON public.traits_config FROM anon, authenticated;
REVOKE ALL ON public.traits_assessments FROM anon, authenticated;

-- ==============================================================================
-- Check it worked:
--
--   SELECT jsonb_array_length(traits) FROM public.traits_config;      -- 14
--   SELECT count(*) FROM public.traits_assessments;                  -- 0 until a
--                                                                      teacher files one
--   SELECT column_name, data_type, is_generated FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'traits_assessments'
--     ORDER BY ordinal_position;
--
-- If CREATE TABLE for traits_assessments fails on the FOREIGN KEY, the pupils
-- table has lost its primary key on id — say so rather than dropping the
-- REFERENCES. Without it, an assessment can outlive its pupil and be re-shown
-- against whichever child is later given the same id.
-- ==============================================================================
