-- Patch 4: Add payment and debt tracking fields to purchase_invoices

ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS paid_cash NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS paid_visa NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS paid_wallet NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS paid_instapay NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC DEFAULT 0;
