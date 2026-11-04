-- ==============================================================================
-- ROYAL CROWN ACADEMY — PUBLICATION, TERM CLOSURE AND SCHOOL SETTINGS
-- Run this in the Supabase SQL editor, after schema.sql, app_accounts.sql,
-- harden-rls.sql and guardian_students.sql. It is safe to run again.
--
-- These three tables hold the things the portal previously kept in a single
-- browser's localStorage, which is why three screens could claim something had
-- happened when nothing on the school's records had changed:
--
--   Publish Results   wrote "rca_published_classes_v6" into the headteacher's
--                     own browser. Another teacher, or a parent on a phone, saw
--                     nothing at all — and the button still said "Published and
--                     authorized results for SS 2!".
--   End of Term       was a two-second timer that printed "successfully
--                     archived! Next term initialized." No term was closed and
--                     no marks were moved.
--   Settings          accepted the school name, address and phone, then threw
--                     the typing away.
--
-- Every table here is read and written only by the portal's own API routes,
-- which check the signed-in role first. RLS is switched on with no policies, so
-- the browser's anon key cannot read or write any of it.
--
-- IDs use gen_random_uuid(), built into Postgres 13 and newer. The older
-- uuid_generate_v4() used elsewhere needs the "uuid-ossp" extension; on this
-- project it was not enabled, so students.id had no working default and a new
-- pupil could not be enrolled without the server supplying the id itself
-- (/api/students does that now). Restoring the default is optional but tidy:
--
--   ALTER TABLE public.students ALTER COLUMN id SET DEFAULT gen_random_uuid();
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. THE SCHOOL'S CURRENT SESSION AND TERM, AND ITS CONTACT IDENTITY
--
-- One row, always id = 1. The portal used to read these values from a constant
-- compiled into the code (src/lib/constants.ts), so "this term" could not be
-- changed without a redeploy — and the End of Term screen had nothing to move
-- forward to.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    school_name VARCHAR(255) NOT NULL DEFAULT 'Royal Crown Academy',
    short_name VARCHAR(50) NOT NULL DEFAULT 'RCA',
    motto VARCHAR(255) NOT NULL DEFAULT 'Excellence and Integrity',
    address TEXT NOT NULL DEFAULT 'No 5 Resort Road, Rayfield, Jos South LGA, Plateau State',
    email VARCHAR(255) NOT NULL DEFAULT 'admin@royalcrownacademy.edu.ng',
    phone VARCHAR(100) NOT NULL DEFAULT '0803 123 4567',
    website VARCHAR(255) NOT NULL DEFAULT 'www.royalcrownacademy.edu.ng',
    current_session VARCHAR(50) NOT NULL DEFAULT '2025/2026',
    current_term VARCHAR(50) NOT NULL DEFAULT 'First Term',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100) NOT NULL DEFAULT ''
);

INSERT INTO public.school_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.school_config ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. RESULT PUBLICATIONS
--
-- One row per class per session per term that the exam office has released.
-- A parent's report card is gated on this row existing for their child's class,
-- so "Authorize & Publish" changes what a family actually sees instead of only
-- changing the button on the screen that was clicked.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.result_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session VARCHAR(50) NOT NULL,
    term VARCHAR(50) NOT NULL,
    class_name VARCHAR(100) NOT NULL,
    published BOOLEAN NOT NULL DEFAULT true,
    published_by VARCHAR(100) NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT result_publications_scope_unique UNIQUE (session, term, class_name)
);

CREATE INDEX IF NOT EXISTS idx_result_publications_session_term
    ON public.result_publications(session, term);

ALTER TABLE public.result_publications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. CLOSED TERMS
--
-- One row per session per term the office has archived. /api/ca refuses to file
-- or change a mark inside a closed term, which is the whole point: the marks for
-- a term that has been signed off cannot be edited afterwards. Closing a term
-- does not delete anything — every mark stays readable, so last term's cards can
-- still be printed. The office can re-open a term from the same screen.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.closed_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session VARCHAR(50) NOT NULL,
    term VARCHAR(50) NOT NULL,
    closed_by VARCHAR(100) NOT NULL DEFAULT '',
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT closed_terms_scope_unique UNIQUE (session, term)
);

ALTER TABLE public.closed_terms ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. THE FEE SCHEDULE
--
-- The bursar's termly bill. This list lived in one browser's localStorage, but
-- its amounts are added up and written into the invoices table, which IS a
-- school record. Machine A could charge every family ₦145,000 made of fee items
-- machine B never entered and could not even list, and no printout could be
-- traced back to the person who set the price. The schedule an invoice was
-- built from now lives on the same side of the network as the invoice.
--
-- Nothing is seeded here on purpose. The amounts are the school's to set, from
-- Setup → Fee Structure; inventing a standard bill in a migration is exactly
-- the thing this portal is trying to stop doing.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fee_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Tuition',
    applicable_class VARCHAR(100) NOT NULL DEFAULT 'All Classes',
    amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    session VARCHAR(50) NOT NULL,
    term VARCHAR(50) NOT NULL,
    updated_by VARCHAR(100) NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fee_components_scope_unique UNIQUE (name, applicable_class, session, term)
);

CREATE INDEX IF NOT EXISTS idx_fee_components_session_term
    ON public.fee_components(session, term);

ALTER TABLE public.fee_components ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5. PAYMENT RECEIPTS
--
-- A fee payment used to change one number on the invoice and say "Payment
-- recorded". Nothing was filed of who took it, how, or against which teller,
-- so the money in the collected total could not be traced to anything a person
-- entered. The portal now writes a row into the existing transactions table for
-- every payment, and these two columns hold what makes it traceable.
--
-- transactions already exists (supabase/schema.sql); this only adds to it, and
-- is safe to run more than once.
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS bank_reference VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS received_by VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS session VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS term VARCHAR(50) NOT NULL DEFAULT '';

-- ------------------------------------------------------------------------------
-- Grants. Service-role traffic bypasses row security, but a table still has to be
-- granted to the role that touches it. Supabase normally grants these when the
-- project is new; on a project created before these tables existed they can be
-- missing, and the portal then reports "permission denied for table …". The
-- grants follow the role, so rotating a key needs none of this re-run.
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_publications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closed_terms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_components TO service_role;
-- The new payment receipts write into the table schema.sql already created.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO service_role;

-- The anon and authenticated roles are deliberately left out: a browser with
-- either key must go through the portal's API routes, not these tables.
REVOKE ALL ON public.school_config FROM anon, authenticated;
REVOKE ALL ON public.result_publications FROM anon, authenticated;
REVOKE ALL ON public.closed_terms FROM anon, authenticated;
REVOKE ALL ON public.fee_components FROM anon, authenticated;

-- ==============================================================================
-- Check it worked. These rows back, with current_session '2025/2026':
--
--   SELECT current_session, current_term FROM public.school_config;
--   SELECT count(*) FROM public.result_publications;
--   SELECT count(*) FROM public.closed_terms;
--   SELECT count(*) FROM public.fee_components;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_schema = 'public' AND table_name = 'transactions'
--     ORDER BY column_name;
-- ==============================================================================
