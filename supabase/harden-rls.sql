-- ==============================================================================
-- ROYAL CROWN ACADEMY — RLS HARDENING SCRIPT
-- Run this in the Supabase SQL editor on an existing database.
-- It removes the blanket "public ALL" policies and leaves the browser able to
-- read reference data only. All student/staff/invoice access now goes through
-- the authenticated API routes, which use the service-role key.
-- ==============================================================================

DROP POLICY IF EXISTS "Allow public read staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public all staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public read students" ON public.students;
DROP POLICY IF EXISTS "Allow public all students" ON public.students;
DROP POLICY IF EXISTS "Allow public read ca_scores" ON public.ca_scores;
DROP POLICY IF EXISTS "Allow public all ca_scores" ON public.ca_scores;
DROP POLICY IF EXISTS "Allow public read grading_tiers" ON public.grading_tiers;
DROP POLICY IF EXISTS "Allow public all grading_tiers" ON public.grading_tiers;
DROP POLICY IF EXISTS "Allow public read cbt_questions" ON public.cbt_questions;
DROP POLICY IF EXISTS "Allow public all cbt_questions" ON public.cbt_questions;
DROP POLICY IF EXISTS "Allow public read cbt_exam_sessions" ON public.cbt_exam_sessions;
DROP POLICY IF EXISTS "Allow public all cbt_exam_sessions" ON public.cbt_exam_sessions;
DROP POLICY IF EXISTS "Allow public read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow public all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow public read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow public all audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow public read inmail" ON public.inmail_messages;
DROP POLICY IF EXISTS "Allow public all inmail" ON public.inmail_messages;

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cbt_exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inmail_messages ENABLE ROW LEVEL SECURITY;

-- Reference data the browser may read directly (no personal information).
DROP POLICY IF EXISTS "Public read grading tiers" ON public.grading_tiers;
CREATE POLICY "Public read grading tiers" ON public.grading_tiers
    FOR SELECT TO anon, authenticated USING (true);
