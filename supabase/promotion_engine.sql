-- ==============================================================================
-- ROYAL CROWN ACADEMY & HIGH SCHOOL — PROMOTION ENGINE & POSITION TOGGLE
-- Additive Migration (Expand-and-Contract Pattern)
-- Safe to re-run: tables/columns are created IF NOT EXISTS, nothing is dropped.
-- ==============================================================================

-- 1. Class section override for class arms (nullable, defaults to NULL)
ALTER TABLE public.class_arms 
    ADD COLUMN IF NOT EXISTS section_override VARCHAR(40);

COMMENT ON COLUMN public.class_arms.section_override IS
  'Optional manual override for school level (PRIMARY or SECONDARY). When NULL, inferred from section column.';

-- 2. Promotion settings table (single configuration row, id = 1)
CREATE TABLE IF NOT EXISTS public.promotion_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    -- Primary school criteria: Royal Crown Academy
    primary_avg_threshold NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CHECK (primary_avg_threshold >= 0 AND primary_avg_threshold <= 100),
    primary_pass_threshold NUMERIC(5, 2) NOT NULL DEFAULT 40.00 CHECK (primary_pass_threshold >= 0 AND primary_pass_threshold <= 100),
    -- Secondary school criteria: Royal Crown High School
    secondary_avg_threshold NUMERIC(5, 2) NOT NULL DEFAULT 60.00 CHECK (secondary_avg_threshold >= 0 AND secondary_avg_threshold <= 100),
    secondary_credit_threshold NUMERIC(5, 2) NOT NULL DEFAULT 50.00 CHECK (secondary_credit_threshold >= 0 AND secondary_credit_threshold <= 100),
    -- Global scorecard toggle: show or hide class rank/position
    show_class_position BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(100) NOT NULL DEFAULT ''
);

-- Ensure default row exists
INSERT INTO public.promotion_settings (
    id, primary_avg_threshold, primary_pass_threshold,
    secondary_avg_threshold, secondary_credit_threshold, show_class_position
) VALUES (1, 50.00, 40.00, 60.00, 50.00, true)
ON CONFLICT (id) DO NOTHING;

-- Row Level Security
ALTER TABLE public.promotion_settings ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_settings TO service_role;
REVOKE ALL ON public.promotion_settings FROM anon, authenticated;

-- Verification:
-- SELECT id, primary_avg_threshold, primary_pass_threshold, secondary_avg_threshold, secondary_credit_threshold, show_class_position FROM public.promotion_settings;
