-- ==============================================================================
-- ROYAL CROWN ACADEMY & HIGH SCHOOL — STUDENT EXTENDED PROFILE
-- Additive Migration (Expand-and-Contract Pattern)
-- Safe to re-run: columns are added IF NOT EXISTS with safe defaults or NULL.
-- ==============================================================================

ALTER TABLE public.students
    ADD COLUMN IF NOT EXISTS school_brand VARCHAR(80) NOT NULL DEFAULT 'Royal Crown Academy',
    ADD COLUMN IF NOT EXISTS section VARCHAR(40) NOT NULL DEFAULT 'PRIMARY',
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS medical_notes TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS allergies TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS guardian_address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(50) NOT NULL DEFAULT 'Parent',
    ADD COLUMN IF NOT EXISTS admission_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(100) NOT NULL DEFAULT 'Nigerian',
    ADD COLUMN IF NOT EXISTS state_of_origin VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS lga VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS religion VARCHAR(60) NOT NULL DEFAULT 'Christianity',
    ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN public.students.school_brand IS 
  'Institutional campus branding: Royal Crown Academy (Primary) or Royal Crown High School (Secondary).';

CREATE INDEX IF NOT EXISTS idx_students_school_brand ON public.students(school_brand);
CREATE INDEX IF NOT EXISTS idx_students_section ON public.students(section);

-- Verification:
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns WHERE table_name = 'students' ORDER BY ordinal_position;
