-- ==============================================================================
-- ROYAL CROWN ACADEMY — RECORDS & DOSSIER CONFIGURATION
-- Dynamic Signatories, Authorization Footer & Letterhead Configuration
-- Run this in the Supabase SQL editor. Strictly additive and zero-downtime safe.
-- ==============================================================================

ALTER TABLE public.school_config
  ADD COLUMN IF NOT EXISTS primary_signatory_name VARCHAR(255) DEFAULT 'Head Teacher',
  ADD COLUMN IF NOT EXISTS primary_signatory_title VARCHAR(255) DEFAULT 'Head of Primary School',
  ADD COLUMN IF NOT EXISTS primary_signature_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS secondary_signatory_name VARCHAR(255) DEFAULT 'Dr. Mrs. P. O. Awoniyi',
  ADD COLUMN IF NOT EXISTS secondary_signatory_title VARCHAR(255) DEFAULT 'Principal / Head of School',
  ADD COLUMN IF NOT EXISTS secondary_signature_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS auth_footer_note TEXT DEFAULT 'This document is system-generated and valid only with the official school seal and authorized signature.';
