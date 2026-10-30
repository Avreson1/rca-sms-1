-- ==============================================================================
-- ROYAL CROWN ACADEMY — APP-GENERATED LOGIN ACCOUNTS (TESTERS ROLE)
-- Run this in the Supabase SQL editor after schema.sql.
-- Stores app-generated logins (created by the super admin from Settings).
-- Passwords are stored as salted scrypt hashes — never as plaintext.
-- No RLS policies are created on purpose: only the server (service-role key)
-- can read or write this table.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'TESTERS',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_app_accounts_username ON public.app_accounts(username);
