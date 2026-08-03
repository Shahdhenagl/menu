-- Patch v29: تصليح اسم عمود رصيد مخزن التوزيع
--
-- المشكلة: الجدول اتعمل من الأول بعمود اسمه stock_distribution،
-- لكن الكود كله بيقرا ويكتب stock_bar. النتيجة إن أرصدة مخزن التوزيع
-- ماكانتش بتتحفظ في الداتا بيز فعليًا (بتقع وترجع محلي).
--
-- الملف ده بيعيد تسمية العمود مع الحفاظ على الأرصدة الموجودة فيه.
-- آمن التشغيل أكتر من مرة.
-- شغّله في Supabase SQL Editor.

DO $$
BEGIN
  -- لو عندنا stock_distribution ومفيش stock_bar → نعيد التسمية (الأرصدة بتفضل زي ما هي)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'stock_distribution'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'stock_bar'
  ) THEN
    ALTER TABLE inventory_items RENAME COLUMN stock_distribution TO stock_bar;

  -- لو الاتنين موجودين (حالة نادرة) → ننقل الأرصدة ونسيب stock_bar هو المعتمد
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'stock_distribution'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'stock_bar'
  ) THEN
    UPDATE inventory_items
       SET stock_bar = COALESCE(NULLIF(stock_bar, 0), stock_distribution, 0);
  END IF;
END $$;

-- ضمان وجود العمود في أي حالة تانية
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS stock_bar NUMERIC DEFAULT 0;
