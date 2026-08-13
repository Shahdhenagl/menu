-- تحديث أسعار الشيش حسب الأسعار المطلوبة
-- مهم: شغّل قسم المعاينة أولًا، وتأكد من الأسماء المطابقة قبل تنفيذ قسم التحديث.

-- =========================
-- 1) معاينة الأصناف والأسعار الحالية
-- =========================
WITH new_prices (name_ar, new_price) AS (
  VALUES
    ('شيشة كيوي', 120.00::NUMERIC),
    ('شيشة تويست', 120.00::NUMERIC),
    ('شيشة ليمون نعناع', 120.00::NUMERIC),
    ('شيشة نعناع', 120.00::NUMERIC),
    ('شيشة بلو بيري', 120.00::NUMERIC),
    ('شيشة مانجا', 120.00::NUMERIC),
    ('شيشة خوخ', 120.00::NUMERIC),
    ('شيشة تفاح', 120.00::NUMERIC),
    ('شيشة كيوي مانجا', 120.00::NUMERIC),
    ('شيشة علب', 120.00::NUMERIC),
    ('شيشة علب اسود', 120.00::NUMERIC),
    ('شيشة علب نعناع', 120.00::NUMERIC),
    ('شيشة كولا', 120.00::NUMERIC),
    ('شيشة كانتلوب', 120.00::NUMERIC),
    ('شيشة بطيخ', 120.00::NUMERIC),
    ('شيشة فصول', 120.00::NUMERIC),
    ('شيشة مكس', 120.00::NUMERIC),
    ('شيشة مريديان', 120.00::NUMERIC),
    ('شيشة VIP', 120.00::NUMERIC),
    ('شيشة فراولة', 70.00::NUMERIC),
    ('شيشة فرنساوي', 120.00::NUMERIC),
    ('شيشة سلوم', 30.00::NUMERIC),
    ('لية طبي', 25.00::NUMERIC)
)
SELECT
  p.id,
  p.name_ar,
  p.name_en,
  p.price AS current_price,
  n.new_price,
  CASE
    WHEN p.id IS NULL THEN 'غير موجود'
    WHEN p.price = n.new_price THEN 'مطابق بالفعل'
    ELSE 'سيتم التحديث'
  END AS action
FROM new_prices n
LEFT JOIN products p ON lower(trim(p.name_ar)) = lower(trim(n.name_ar))
ORDER BY n.name_ar;

-- =========================
-- 2) تنفيذ تحديث الأسعار
-- =========================
-- نفّذ هذا الجزء بعد مراجعة نتيجة المعاينة السابقة.
BEGIN;

WITH new_prices (name_ar, new_price) AS (
  VALUES
    ('شيشة كيوي', 120.00::NUMERIC),
    ('شيشة تويست', 120.00::NUMERIC),
    ('شيشة ليمون نعناع', 120.00::NUMERIC),
    ('شيشة نعناع', 120.00::NUMERIC),
    ('شيشة بلو بيري', 120.00::NUMERIC),
    ('شيشة مانجا', 120.00::NUMERIC),
    ('شيشة خوخ', 120.00::NUMERIC),
    ('شيشة تفاح', 120.00::NUMERIC),
    ('شيشة كيوي مانجا', 120.00::NUMERIC),
    ('شيشة علب', 120.00::NUMERIC),
    ('شيشة علب اسود', 120.00::NUMERIC),
    ('شيشة علب نعناع', 120.00::NUMERIC),
    ('شيشة كولا', 120.00::NUMERIC),
    ('شيشة كانتلوب', 120.00::NUMERIC),
    ('شيشة بطيخ', 120.00::NUMERIC),
    ('شيشة فصول', 120.00::NUMERIC),
    ('شيشة مكس', 120.00::NUMERIC),
    ('شيشة مريديان', 120.00::NUMERIC),
    ('شيشة VIP', 120.00::NUMERIC),
    ('شيشة فراولة', 70.00::NUMERIC),
    ('شيشة فرنساوي', 120.00::NUMERIC),
    ('شيشة سلوم', 30.00::NUMERIC),
    ('لية طبي', 25.00::NUMERIC)
)
UPDATE products p
SET price = n.new_price
FROM new_prices n
WHERE lower(trim(p.name_ar)) = lower(trim(n.name_ar));

COMMIT;

-- =========================
-- 3) التحقق بعد التحديث
-- =========================
WITH new_prices (name_ar, new_price) AS (
  VALUES
    ('شيشة كيوي', 120.00::NUMERIC),
    ('شيشة تويست', 120.00::NUMERIC),
    ('شيشة ليمون نعناع', 120.00::NUMERIC),
    ('شيشة نعناع', 120.00::NUMERIC),
    ('شيشة بلو بيري', 120.00::NUMERIC),
    ('شيشة مانجا', 120.00::NUMERIC),
    ('شيشة خوخ', 120.00::NUMERIC),
    ('شيشة تفاح', 120.00::NUMERIC),
    ('شيشة كيوي مانجا', 120.00::NUMERIC),
    ('شيشة علب', 120.00::NUMERIC),
    ('شيشة علب اسود', 120.00::NUMERIC),
    ('شيشة علب نعناع', 120.00::NUMERIC),
    ('شيشة كولا', 120.00::NUMERIC),
    ('شيشة كانتلوب', 120.00::NUMERIC),
    ('شيشة بطيخ', 120.00::NUMERIC),
    ('شيشة فصول', 120.00::NUMERIC),
    ('شيشة مكس', 120.00::NUMERIC),
    ('شيشة مريديان', 120.00::NUMERIC),
    ('شيشة VIP', 120.00::NUMERIC),
    ('شيشة فراولة', 70.00::NUMERIC),
    ('شيشة فرنساوي', 120.00::NUMERIC),
    ('شيشة سلوم', 30.00::NUMERIC),
    ('لية طبي', 25.00::NUMERIC)
)
SELECT p.name_ar, p.price
FROM products p
JOIN new_prices n ON lower(trim(p.name_ar)) = lower(trim(n.name_ar))
ORDER BY p.name_ar;
