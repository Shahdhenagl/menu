-- v39: Customer debt settlements / customer deposits
-- Run in Supabase SQL Editor after the base customers table exists.

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS total_debt NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.customer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  employee_id UUID,
  employee_name TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  drawer SMALLINT CHECK (drawer IN (1, 2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS employee_id UUID,
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS drawer SMALLINT;

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS drawer SMALLINT;

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_date
  ON public.customer_payments (customer_id, payment_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_payments_drawer_date
  ON public.customer_payments (drawer, payment_date DESC, created_at DESC);

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_payments_all ON public.customer_payments;
CREATE POLICY customer_payments_all
  ON public.customer_payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMIT;

-- Verification queries:
-- SELECT id, name, total_debt FROM public.customers ORDER BY created_at DESC LIMIT 20;
-- SELECT id, customer_id, amount, payment_method, drawer, payment_date, created_at
-- FROM public.customer_payments ORDER BY created_at DESC LIMIT 20;
-- SELECT id, type, amount, to_method, drawer, created_at
-- FROM public.financial_transactions
-- WHERE type = 'debt_settlement' ORDER BY created_at DESC LIMIT 20;
