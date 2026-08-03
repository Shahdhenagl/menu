-- Patch v28: أعمدة التفصيل الجديدة في سجلات تقفيل الشفتات
-- (التفصيل حسب نوع الطلب + تجميع الضرائب حسب النسبة)
-- شغّله في Supabase SQL Editor بعد patch v26.

ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS order_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS tax_groups  JSONB NOT NULL DEFAULT '[]'::jsonb;
