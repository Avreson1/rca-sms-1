-- ==============================================================================
-- ROYAL CROWN ACADEMY — APP-MANAGED LOGIN ACCOUNTS
-- Run this in the Supabase SQL editor, after schema.sql.
--
-- One row per human: the super admin creates people from Settings → User Access
-- instead of editing environment variables and redeploying. Passwords are stored
-- only as salted scrypt hashes and are shown once, at creation or reset.
--
-- status      'Active' or 'Suspended'. A suspended row cannot sign in, and any
--             session already issued to it is rejected on the next request.
-- token_epoch Bumped whenever the password is reset or the account is suspended
--             or restored. The signed session cookie carries the epoch it was
--             issued with; a mismatch means that cookie predates the change and
--             is no longer valid. This is what makes a stateless cookie revocable.
--
-- Deliberately no RLS policies: RLS is enabled and no policy grants access, so
-- only the server (service-role key) can read or write this table. The browser's
-- anon key sees nothing, including the hashes.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'TESTERS',
    staff_id VARCHAR(64) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    token_epoch BIGINT NOT NULL DEFAULT 1,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- For databases that already ran the earlier, TESTERS-only version of this script.
ALTER TABLE public.app_accounts ADD COLUMN IF NOT EXISTS staff_id    VARCHAR(64)  NOT NULL DEFAULT '';
ALTER TABLE public.app_accounts ADD COLUMN IF NOT EXISTS email       VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE public.app_accounts ADD COLUMN IF NOT EXISTS status      VARCHAR(20)  NOT NULL DEFAULT 'Active';
ALTER TABLE public.app_accounts ADD COLUMN IF NOT EXISTS token_epoch BIGINT       NOT NULL DEFAULT 1;

ALTER TABLE public.app_accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_app_accounts_username ON public.app_accounts(username);
