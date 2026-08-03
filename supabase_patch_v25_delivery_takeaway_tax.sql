-- Patch v25: ضريبة مستقلة للدليفري والتيك أواي
-- شغّله في Supabase SQL Editor.

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS tax_percent_delivery NUMERIC DEFAULT 0;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS tax_percent_takeaway NUMERIC DEFAULT 0;
