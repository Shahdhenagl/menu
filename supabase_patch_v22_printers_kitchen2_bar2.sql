-- Patch v22: طابعة تانية للمطبخ وطابعة تانية للبار (QZ Tray)
-- شغّله في Supabase SQL Editor.

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_kitchen_2 TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS qz_printer_bar_2 TEXT;
