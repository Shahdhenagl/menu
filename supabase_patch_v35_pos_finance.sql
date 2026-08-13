-- Patch v35: POS customer deposits, expense classification, and inventory purchase details
-- Run this migration in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS customer_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  notes TEXT,
  employee_id UUID,
  employee_name TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  drawer SMALLINT CHECK (drawer IN (1, 2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_date
  ON customer_payments (customer_id, payment_date DESC);

ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_payments_all ON customer_payments;
CREATE POLICY customer_payments_all ON customer_payments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS classification_status TEXT DEFAULT 'pending';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purchase_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_item_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_quantity NUMERIC;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS inventory_unit_price NUMERIC;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS drawer SMALLINT;
ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS drawer SMALLINT;

CREATE INDEX IF NOT EXISTS idx_expenses_source_classification
  ON expenses (source, classification_status, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_purchase_invoice
  ON expenses (purchase_invoice_id);

COMMIT;
