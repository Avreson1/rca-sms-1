-- ==============================================================================
-- ROYAL CROWN ACADEMY & HIGH SCHOOL — STAFF EXTENDED PROFILE
-- Additive Migration (Expand-and-Contract Pattern)
-- Safe to re-run: columns are added IF NOT EXISTS with safe defaults or NULL.
-- ==============================================================================

ALTER TABLE public.staff
    ADD COLUMN IF NOT EXISTS school_brand VARCHAR(80) NOT NULL DEFAULT 'Royal Crown Academy',
    ADD COLUMN IF NOT EXISTS staff_type VARCHAR(30) NOT NULL DEFAULT 'Teaching' CHECK (staff_type IN ('Teaching', 'Non-Teaching', 'Administrative', 'Management')),
    ADD COLUMN IF NOT EXISTS designation VARCHAR(100) NOT NULL DEFAULT 'Teacher',
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS employment_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS qualifications TEXT NOT NULL DEFAULT 'B.Ed / B.Sc',
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(30) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS account_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS salary_grade VARCHAR(50) NOT NULL DEFAULT 'Level 1',
    ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) NOT NULL DEFAULT 'Nigerian',
    ADD COLUMN IF NOT EXISTS state_of_origin VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.staff.staff_type IS 
  'Category: Teaching vs Non-Teaching vs Administrative vs Management.';

CREATE INDEX IF NOT EXISTS idx_staff_staff_type ON public.staff(staff_type);
CREATE INDEX IF NOT EXISTS idx_staff_school_brand ON public.staff(school_brand);

-- Verification:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns WHERE table_name = 'staff' ORDER BY ordinal_position;
