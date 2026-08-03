-- Patch v27: خزنتين (خزنة 1 و خزنة 2) — كل صالة بتحصّل في خزنة، والدليفري/التيك أواي/الطلبات
-- الكاشير بيختار خزنتها وقت التحصيل. التقفيل بقى على مستوى الخزنة.
-- شغّله في Supabase SQL Editor.

-- الخزنة اللي اتحصّل فيها الأوردر (1 أو 2)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS drawer SMALLINT;

-- أسماء الخزن (اختياري — الافتراضي "خزنة 1" و "خزنة 2")
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS drawer_1_name TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS drawer_2_name TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_drawer ON orders (drawer);

-- ملاحظة: ربط كل صالة بخزنتها بيتخزن جوه عمود halls (JSONB) على شكل
--   [{ "name": "صالة 1", "tax_percent": 14, "drawer": 1 }, ...]
-- فمش محتاج عمود جديد ليه.
