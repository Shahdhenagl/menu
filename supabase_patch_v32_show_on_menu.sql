-- ================================================================
-- Patch v32: إخفاء تصنيفات محددة من منيو العملاء
-- نفّذه في: Supabase SQL Editor
-- ================================================================

BEGIN;

-- إضافة عمود show_on_menu للتصنيفات (الافتراضي: true = ظاهر)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS show_on_menu BOOLEAN DEFAULT true;

-- إخفاء "مشروبات الاستاف" من منيو العملاء
UPDATE categories SET show_on_menu = false WHERE name_ar = 'مشروبات الاستاف';

COMMIT;
