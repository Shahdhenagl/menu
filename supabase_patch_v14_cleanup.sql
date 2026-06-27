-- Patch v14: تنظيف المخازن + إبقاء المنتجات اللي ليها صور فقط
-- ⚠️ تحذير: السكريبت ده بيمسح بيانات نهائياً. خد باك أب قبل ما تشغّله لو محتاج.

-- ============================================================
-- (1) مسح كل بيانات المخازن / المخزون / التصنيع / التوزيع
-- ============================================================
-- CASCADE بيمسح أي صفوف مرتبطة في الجداول التابعة تلقائياً.
TRUNCATE TABLE
  inventory_movements,
  manufacturing_recipes,
  manufacturing_orders,
  production_logs,
  purchase_invoices,
  product_recipes,
  distribution_products,
  inventory_items
RESTART IDENTITY CASCADE;

-- (اختياري) لو عايز تمسح الموردين كمان، شيل علامة التعليق من السطر التالي:
-- TRUNCATE TABLE suppliers RESTART IDENTITY CASCADE;

-- ============================================================
-- (2) المنتجات: امسح أي منتج مالوش صورة
-- ============================================================
-- ملاحظة: حذف المنتج بيمسح تلقائياً تعليقاته ووصفاته (ON DELETE CASCADE).
DELETE FROM products
WHERE image_url IS NULL
   OR btrim(image_url) = '';

-- ============================================================
-- (3) التصنيفات: امسح أي تصنيف مفيهوش منتجات (بعد حذف منتجات بلا صور)
-- ============================================================
DELETE FROM categories
WHERE id NOT IN (
  SELECT DISTINCT category_id
  FROM products
  WHERE category_id IS NOT NULL
);