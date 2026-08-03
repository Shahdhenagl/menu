-- 🟢 شغّل ده مرة واحدة في Supabase SQL Editor — بيضيف كل الأعمدة الجديدة اللازمة
-- (آمن للتشغيل أكتر من مرة — IF NOT EXISTS)

-- الصالات وضريبة كل صالة (v23)
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS halls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders             ADD COLUMN IF NOT EXISTS hall TEXT;

-- الطابعة التانية للمطبخ/البار (v22)
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_kitchen_2 TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_bar_2 TEXT;

-- دفع فواتير المشتريات من عهدة الشريك (v21)
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS paid_petty_cash NUMERIC DEFAULT 0;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS partner_id UUID;
