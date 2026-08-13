-- Patch v38: complete expenses table for POS withdrawals and Admin reports.
-- Run once in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'مصروف غير مصنف',
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  partner_id UUID,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  drawer SMALLINT CHECK (drawer IN (1, 2)),
  notes TEXT,
  employee_id UUID,
  employee_name TEXT,
  source TEXT NOT NULL DEFAULT 'admin',
  classification_status TEXT NOT NULL DEFAULT 'pending',
  purchase_invoice_id UUID,
  supplier_name TEXT,
  inventory_item_id UUID,
  inventory_item_name TEXT,
  inventory_quantity NUMERIC,
  inventory_unit_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'مصروف غير مصنف';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS partner_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS drawer SMALLINT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purchase_invoice_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_item_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_item_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_quantity NUMERIC;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_unit_price NUMERIC;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE expenses ALTER COLUMN type SET DEFAULT 'مصروف غير مصنف';
ALTER TABLE expenses ALTER COLUMN source SET DEFAULT 'admin';
ALTER TABLE expenses ALTER COLUMN classification_status SET DEFAULT 'pending';
ALTER TABLE expenses ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_drawer_date ON expenses (drawer, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_source_status ON expenses (source, classification_status, expense_date DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expenses_all ON expenses;
CREATE POLICY expenses_all ON expenses FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE expenses TO anon, authenticated;

COMMIT;
