-- Patch v21: دعم الدفع من عهدة الشريك في فواتير المشتريات
-- شغّله في Supabase SQL Editor.

ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS paid_petty_cash NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS partner_id UUID;
