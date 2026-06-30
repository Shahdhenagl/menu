-- ============================================================================
-- Patch v19: ربط منتجي التاكو (بيف + دجاج) بعد ما اتقسموا لمنتجين منفصلين
-- البيف -> "لحم كفتة مصنع" | الدجاج -> "شيش طاووق متبل" (باقي المكونات واحدة)
-- بيلاقي المنتجين تلقائياً بالاسم (أي منتج فيه كلمة "تاكو").
-- آمن لإعادة التشغيل. يشتغل بعد v15 و v16 و v18.
-- ============================================================================

BEGIN;

-- دالة التطبيع (لو مش موجودة)
CREATE OR REPLACE FUNCTION fn_norm_ar(t text) RETURNS text AS $$
  SELECT btrim(regexp_replace(
           translate(coalesce(t,''),
             'أإآٱىةؤئـًٌٍَُِّْٰ',
             'اااايهوي'),
           '[[:space:]]+', ' ', 'g'));
$$ LANGUAGE sql IMMUTABLE;

-- (1) وصفات التاكو في جدول staging — العمود kind: beef أو chicken
DROP TABLE IF EXISTS _taco;
CREATE TABLE _taco(kind text, ing text, qty numeric);
INSERT INTO _taco(kind, ing, qty) VALUES
  -- ----- تاكو بيف -----
  ('beef', 'لحم كفتة مصنع', 0.12),
  ('beef', 'فلفل الوان فريش', 0.02),
  ('beef', 'زيتون شرائح', 0.005),
  ('beef', 'فاصوليا حمراء', 0.005),
  ('beef', 'ذرة حلوة', 0.005),
  ('beef', 'موزاريلا بريما فيرا', 0.08),
  ('beef', 'صوص شيدر مصنع', 0.02),
  ('beef', 'خبز تورتيلا الكيس 5حبات', 1),
  ('beef', 'ريد صوص مصنع', 0.02),
  ('beef', 'دوريتوس', 0.5),
  ('beef', 'كاتشب صغير', 2),
  ('beef', 'أكياس تيك واى مطبوع صغير', 1),
  ('beef', 'شوك بلاستيك', 1),
  ('beef', 'علب برجر تيك واى', 1),
  -- ----- تاكو دجاج (نفس الوصفة بس بدّلنا البروتين لشيش طاووق) -----
  ('chicken', 'شيش طاووق متبل', 0.12),
  ('chicken', 'فلفل الوان فريش', 0.02),
  ('chicken', 'زيتون شرائح', 0.005),
  ('chicken', 'فاصوليا حمراء', 0.005),
  ('chicken', 'ذرة حلوة', 0.005),
  ('chicken', 'موزاريلا بريما فيرا', 0.08),
  ('chicken', 'صوص شيدر مصنع', 0.02),
  ('chicken', 'خبز تورتيلا الكيس 5حبات', 1),
  ('chicken', 'ريد صوص مصنع', 0.02),
  ('chicken', 'دوريتوس', 0.5),
  ('chicken', 'كاتشب صغير', 2),
  ('chicken', 'أكياس تيك واى مطبوع صغير', 1),
  ('chicken', 'شوك بلاستيك', 1),
  ('chicken', 'علب برجر تيك واى', 1);

-- (2) تحديد منتج كل نوع تلقائياً من جدول products
DROP TABLE IF EXISTS _taco_prod;
CREATE TABLE _taco_prod AS
SELECT p.id AS product_id, p.name_ar,
       CASE
         WHEN p.name_ar LIKE '%دجاج%' OR p.name_ar LIKE '%فراخ%'
           OR p.name_ar LIKE '%تشكن%' OR p.name_ar LIKE '%تشيكن%' THEN 'chicken'
         WHEN p.name_ar LIKE '%لحم%' OR p.name_ar LIKE '%بيف%' THEN 'beef'
         ELSE 'beef'  -- افتراضي لو منتج تاكو واحد بدون تحديد
       END AS kind
FROM products p
WHERE p.name_ar LIKE '%تاكو%';

-- (3) مسح وصفات منتجات التاكو القديمة ثم إعادة بنائها
DELETE FROM product_recipes WHERE product_id IN (SELECT product_id FROM _taco_prod);

INSERT INTO product_recipes (product_id, inventory_item_id, quantity)
SELECT tp.product_id, i.id, SUM(t.qty)
FROM _taco_prod tp
JOIN _taco t            ON t.kind = tp.kind
JOIN inventory_items i  ON fn_norm_ar(i.name) = fn_norm_ar(t.ing)
GROUP BY tp.product_id, i.id
ON CONFLICT (product_id, inventory_item_id) DO UPDATE SET quantity = EXCLUDED.quantity;

COMMIT;

-- ============================================================================
-- تحقّق: لازم تشوف منتجين (بيف + دجاج) وكل واحد بروتينه الصح
-- ============================================================================
SELECT tp.name_ar AS المنتج, tp.kind AS النوع,
       count(pr.id) AS عدد_المكونات
FROM _taco_prod tp
LEFT JOIN product_recipes pr ON pr.product_id = tp.product_id
GROUP BY tp.name_ar, tp.kind
ORDER BY 1;

-- لو عايز تتأكد من البروتين المربوط لكل واحد:
-- SELECT tp.name_ar, ii.name AS البروتين
-- FROM _taco_prod tp
-- JOIN product_recipes pr ON pr.product_id = tp.product_id
-- JOIN inventory_items ii ON ii.id = pr.inventory_item_id
-- WHERE ii.name IN ('لحم كفتة مصنع','شيش طاووق متبل');
