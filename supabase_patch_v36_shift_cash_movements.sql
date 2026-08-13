-- Shift closing cash movements: deposits, expenses, and expected balance.
-- Run this migration in the Supabase SQL Editor.

BEGIN;

ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS deposits NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS expenses NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS expected_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS deposits_by_method JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS expenses_by_method JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;

-- Also run supabase_patch_v35_pos_finance.sql if customer_payments.drawer
-- has not been added yet; it assigns each customer deposit to Drawer 1 or Drawer 2.
