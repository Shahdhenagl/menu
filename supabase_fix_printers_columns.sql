-- 🟢 يضمن وجود كل أعمدة الطابعات في إعدادات المطعم (شغّله مرة واحدة في Supabase SQL Editor)
-- آمن للتشغيل أكتر من مرة — IF NOT EXISTS
-- بدون كده أسماء الطابعات بتختفي بعد الحفظ لأن الأعمدة مش موجودة

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS enable_qz_printing   BOOLEAN DEFAULT false;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_cashier   TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_kitchen   TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_kitchen_2 TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_bar       TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_bar_2     TEXT;
