-- ==============================================================================
-- ROYAL CROWN ACADEMY & HIGH SCHOOL
-- ACADEMIC CATALOG REFINEMENT & REFERENTIAL INTEGRITY MIGRATION
-- Run after classes_and_subjects.sql. Strictly additive with safe defaults.
-- ==============================================================================

-- 1. Class Arms Additive Columns
ALTER TABLE public.class_arms 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_class_arms_is_active ON public.class_arms(is_active);
CREATE INDEX IF NOT EXISTS idx_class_arms_sort_order ON public.class_arms(sort_order);

-- 2. Subjects Additive Columns
ALTER TABLE public.subjects 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS school_level VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_subjects_is_active ON public.subjects(is_active);
CREATE INDEX IF NOT EXISTS idx_subjects_school_level ON public.subjects(school_level);
CREATE INDEX IF NOT EXISTS idx_subjects_is_core ON public.subjects(is_core);

-- Ensure Core Subjects (Mathematics & English Language) default is_core = true
UPDATE public.subjects 
SET is_core = true 
WHERE LOWER(name) LIKE '%mathematics%' 
   OR LOWER(name) LIKE '%english language%'
   OR LOWER(name) = 'english'
   OR LOWER(name) = 'maths';
