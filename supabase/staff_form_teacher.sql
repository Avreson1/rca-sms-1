-- ==============================================================================
-- ROYAL CROWN ACADEMY — FORM TEACHER CLASS & SECTION MAPPING
-- Run this in the Supabase SQL editor. It is strictly additive and safe to re-run.
-- ==============================================================================

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS class_id UUID,
  ADD COLUMN IF NOT EXISTS section_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_staff_class_id ON public.staff(class_id);
CREATE INDEX IF NOT EXISTS idx_staff_assigned_class ON public.staff(assigned_class);
