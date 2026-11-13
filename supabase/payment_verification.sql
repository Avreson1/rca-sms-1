-- ==============================================================================
-- ROYAL CROWN ACADEMY & HIGH SCHOOL — PAYMENT RECORDS & TRANSACTION VERIFICATION
-- Additive Migration (Expand-and-Contract Pattern)
-- Safe to re-run: tables/columns are created IF NOT EXISTS, nothing is dropped.
-- ==============================================================================

-- 1. Payment records table with strict UNIQUE normalized transaction ID
CREATE TABLE IF NOT EXISTS public.payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    student_name VARCHAR(255) NOT NULL DEFAULT '',
    admission_no VARCHAR(100) NOT NULL DEFAULT '',
    class_name VARCHAR(100) NOT NULL DEFAULT '',
    session VARCHAR(50) NOT NULL DEFAULT '2025/2026',
    term VARCHAR(50) NOT NULL DEFAULT 'First Term',
    transaction_id VARCHAR(150) NOT NULL,
    -- Normalized transaction ID: trimmed and uppercase for deterministic case-insensitive uniqueness
    normalized_transaction_id VARCHAR(150) GENERATED ALWAYS AS (UPPER(TRIM(transaction_id))) STORED,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('PARTIAL', 'FULL')),
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    balance_remaining NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance_remaining >= 0),
    total_fee_expected NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payee_name VARCHAR(255) NOT NULL,
    narration TEXT NOT NULL DEFAULT '',
    payment_method VARCHAR(80) NOT NULL DEFAULT 'Bank Transfer',
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by VARCHAR(100) NOT NULL DEFAULT '',
    verification_status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN ('VERIFIED', 'FLAGGED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_records_normalized_tx UNIQUE (normalized_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_records_student ON public.payment_records(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_session_term ON public.payment_records(session, term);
CREATE INDEX IF NOT EXISTS idx_payment_records_normalized_tx ON public.payment_records(normalized_transaction_id);

-- 2. Additive columns to existing transactions table for cross-compatibility
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(150),
    ADD COLUMN IF NOT EXISTS normalized_transaction_id VARCHAR(150),
    ADD COLUMN IF NOT EXISTS payee_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS narration TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED';

-- Unique partial index on transactions.normalized_transaction_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_normalized_tx_unique 
    ON public.transactions(normalized_transaction_id) 
    WHERE normalized_transaction_id IS NOT NULL AND normalized_transaction_id != '';

-- 3. Accounting & Ledger tables (Income & Expense tracking)
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('INCOME', 'EXPENSE')),
    category VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session VARCHAR(50) NOT NULL DEFAULT '',
    term VARCHAR(50) NOT NULL DEFAULT '',
    reference VARCHAR(150) NOT NULL DEFAULT '',
    recorded_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_session_term ON public.ledger_entries(session, term);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.ledger_entries(entry_type);

-- Seed default expense categories
INSERT INTO public.expense_categories (name, description) VALUES
    ('Salaries & Payroll', 'Staff salary, pension and payroll disbursements'),
    ('Utilities', 'Electricity, water, diesel and internet bills'),
    ('Maintenance & Repairs', 'Campus infrastructure, plumbing and electrical repairs'),
    ('Stationery & Supplies', 'Examination sheets, markers, office stationery'),
    ('Instructional Materials', 'Laboratory reagents, sports equipment, library books'),
    ('Miscellaneous', 'Other operational expenses approved by bursary')
ON CONFLICT (name) DO NOTHING;

-- 4. Add section tag to fee_components if not present
ALTER TABLE public.fee_components 
    ADD COLUMN IF NOT EXISTS section VARCHAR(40) NOT NULL DEFAULT 'All';

-- RLS & Grants
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO service_role;

REVOKE ALL ON public.payment_records FROM anon, authenticated;
REVOKE ALL ON public.expense_categories FROM anon, authenticated;
REVOKE ALL ON public.ledger_entries FROM anon, authenticated;

-- Verification:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'payment_records' ORDER BY ordinal_position;
