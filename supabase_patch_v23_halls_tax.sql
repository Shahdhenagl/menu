-- Patch v23: الصالات وضريبة كل صالة
-- شغّله في Supabase SQL Editor.

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS halls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hall TEXT;
