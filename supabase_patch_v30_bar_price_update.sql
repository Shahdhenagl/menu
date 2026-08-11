-- ================================================================
-- Patch v30: تحديث أسعار البار + إضافة منتجات وتصنيفات جديدة
-- نفّذه في: Supabase SQL Editor
-- ================================================================

BEGIN;

-- ================================================================
-- PART 1 — تحديث أسعار المنتجات الموجودة
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- شاي
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 35
  WHERE name_ar = 'شاي'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'شاي' LIMIT 1);

-- تقسيم "شاي نعناع / قرنفل" → "شاي نعناع" (40 ج) + "شاي قرنفل" جديد
UPDATE products SET name_ar = 'شاي نعناع', name_en = 'Mint Tea', price = 40
  WHERE name_ar = 'شاي نعناع / قرنفل'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'شاي' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'شاي قرنفل', 'Clove Tea', 40, true
FROM categories c WHERE c.name_ar = 'شاي'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'شاي قرنفل' AND p.category_id = c.id);

UPDATE products SET price = 40
  WHERE name_ar = 'شاي أخضر'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'شاي' LIMIT 1);

-- تقسيم "براد شاي صغير / كبير" → "براد شاي صغير" (45 ج) + "براد شاي كبير" جديد (65 ج)
UPDATE products SET name_ar = 'براد شاي صغير', name_en = 'Tea Pot Small', price = 45
  WHERE name_ar = 'براد شاي صغير / كبير'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'شاي' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'براد شاي كبير', 'Tea Pot Large', 65, true
FROM categories c WHERE c.name_ar = 'شاي'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'براد شاي كبير' AND p.category_id = c.id);

UPDATE products SET price = 65
  WHERE name_ar = 'شاي كرك'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'شاي' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'شاي نكهات', 'Flavored Tea', 40, true
FROM categories c WHERE c.name_ar = 'شاي'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'شاي نكهات' AND p.category_id = c.id);

-- ────────────────────────────────────────────────────────────────
-- كافيين
-- ────────────────────────────────────────────────────────────────
-- تقسيم "اسبريسو سنجل / دبل" → "إسبريسو سنجل" (45 ج) + "إسبريسو دبل" جديد (55 ج)
UPDATE products SET name_ar = 'إسبريسو سنجل', name_en = 'Espresso Single', price = 45
  WHERE name_ar = 'اسبريسو سنجل / دبل'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'إسبريسو دبل', 'Espresso Double', 55, true
FROM categories c WHERE c.name_ar = 'كافيين'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'إسبريسو دبل' AND p.category_id = c.id);

UPDATE products SET price = 80
  WHERE name_ar = 'هابي اسبريسو'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

UPDATE products SET price = 70
  WHERE name_ar = 'ميكاتو'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

UPDATE products SET price = 70
  WHERE name_ar = 'كورتادو'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

UPDATE products SET price = 85
  WHERE name_ar = 'فلات وايت'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

-- تقسيم "كابتشينو كلاسيك / فلفر" → "كابتشينو" (85 ج) + "كابتشينو فليفر" جديد (90 ج)
UPDATE products SET name_ar = 'كابتشينو', name_en = 'Cappuccino', price = 85
  WHERE name_ar = 'كابتشينو كلاسيك / فلفر'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'كابتشينو فليفر', 'Cappuccino Flavor', 90, true
FROM categories c WHERE c.name_ar = 'كافيين'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'كابتشينو فليفر' AND p.category_id = c.id);

UPDATE products SET price = 85
  WHERE name_ar = 'لاتيه'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

UPDATE products SET price = 110
  WHERE name_ar = 'سبانش لاتيه'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'كافيين' LIMIT 1);

-- منتجات جديدة تحت كافيين
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'أمريكانو', 'Americano', 75, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'أمريكانو' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'موكا', 'Mocha', 100, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'موكا' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'كوفي ميكس', 'Coffee Mix', 55, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'كوفي ميكس' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'كريزي موكا', 'Crazy Mocha', 100, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'كريزي موكا' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'أمريكان كوفي', 'American Coffee', 95, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'أمريكان كوفي' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'نسكافيه بلاك', 'Nescafe Black', 85, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'نسكافيه بلاك' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'هوت سينابون', 'Hot Cinnamon Bun', 75, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'هوت سينابون' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'حمص الشام', 'Sham Coffee', 75, true FROM categories c WHERE c.name_ar = 'كافيين' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'حمص الشام' AND p.category_id = c.id);

-- ────────────────────────────────────────────────────────────────
-- أعشاب
-- ────────────────────────────────────────────────────────────────
UPDATE products SET name_ar = 'أعشاب', name_en = 'Herbals', price = 40
  WHERE name_ar = 'أعشاب (نعناع ينسون كركديه)'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'أعشاب' LIMIT 1);

-- ────────────────────────────────────────────────────────────────
-- قهوة
-- ────────────────────────────────────────────────────────────────
-- تقسيم "قهوة تركي سنجل / دبل" → "قهوة تركي سنجل" (40 ج) + "قهوة تركي دبل" جديد (45 ج)
UPDATE products SET name_ar = 'قهوة تركي سنجل', name_en = 'Turkish Coffee Single', price = 40
  WHERE name_ar = 'قهوة تركي سنجل / دبل'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'قهوة' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'قهوة تركي دبل', 'Turkish Coffee Double', 45, true
FROM categories c WHERE c.name_ar = 'قهوة'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'قهوة تركي دبل' AND p.category_id = c.id);

UPDATE products SET price = 50
  WHERE name_ar = 'قهوة فرنساوي'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'قهوة' LIMIT 1);

UPDATE products SET price = 55
  WHERE name_ar = 'قهوة بندق'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'قهوة' LIMIT 1);

-- ────────────────────────────────────────────────────────────────
-- هوت شوكليت
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 85  WHERE name_ar = 'هوت شوكليت كلاسيك' AND category_id = (SELECT id FROM categories WHERE name_ar = 'هوت شوكليت' LIMIT 1);
UPDATE products SET price = 95  WHERE name_ar = 'هوت شوكليت نوتيلا'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'هوت شوكليت' LIMIT 1);
UPDATE products SET price = 95  WHERE name_ar = 'هوت شوكليت لوتس'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'هوت شوكليت' LIMIT 1);

-- ────────────────────────────────────────────────────────────────
-- سحلب
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 90
  WHERE name_ar = 'سحلب مكسرات'
    AND category_id = (SELECT id FROM categories WHERE name_ar = 'سحلب' LIMIT 1);
-- سحلب نوتيلا/لوتس = 95 (نفس السعر) | سحلب اوريو = 95 | سحلب فواكه = 125 → لا تغيير

-- ────────────────────────────────────────────────────────────────
-- آيس
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 90  WHERE name_ar = 'ايس امريكانو'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'ايس سبانش لاتيه'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 105 WHERE name_ar = 'ايس ميكاتو'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ايس نوتيلا'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ايس لاتيه'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ايس موكا'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 105 WHERE name_ar = 'ايس كابتشينو'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 105 WHERE name_ar = 'ايس كراميل'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);
UPDATE products SET price = 105 WHERE name_ar = 'ايس تشوكليت'      AND category_id = (SELECT id FROM categories WHERE name_ar = 'آيس' LIMIT 1);

-- ────────────────────────────────────────────────────────────────
-- ميلك شيك
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 110 WHERE name_ar = 'ميلك شيك فانيليا'                        AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ميلك شيك تشوكلت'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ميلك شيك فراولة'                          AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ميلك شيك مانجو'                           AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'ميلك شيك كراميل'                          AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET price = 105 WHERE name_ar = 'ميلك شيك بلوبيري'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'ميلك شيك اوريو'                           AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET price = 120 WHERE name_ar = 'ميلك تشيز (نوتيلا/لوتس/بيستاشيو/كيندر)' AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'ميلك شيك لوتس',     'Lotus Milk Shake',     105, true FROM categories c WHERE c.name_ar = 'ميلك شيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'ميلك شيك لوتس'     AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'ميلك شيك نوتيلا',   'Nutella Milk Shake',   105, true FROM categories c WHERE c.name_ar = 'ميلك شيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'ميلك شيك نوتيلا'   AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'ميلك شيك بيستاشيو', 'Pistachio Milk Shake', 120, true FROM categories c WHERE c.name_ar = 'ميلك شيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'ميلك شيك بيستاشيو' AND p.category_id = c.id);

-- ────────────────────────────────────────────────────────────────
-- فرابيه
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 100 WHERE name_ar = 'فرابيه كوفي'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'فرابيه' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'فرابيه كراميل'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'فرابيه' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'فرابيه فانيليا' AND category_id = (SELECT id FROM categories WHERE name_ar = 'فرابيه' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'فرابيه تشوكلت'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'فرابيه' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'فرابيه نوتيلا'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'فرابيه' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'فرابيه لوتس'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'فرابيه' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'فرابيه بندق', 'Hazelnut Frappe', 115, true
FROM categories c WHERE c.name_ar = 'فرابيه'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'فرابيه بندق' AND p.category_id = c.id);

-- ────────────────────────────────────────────────────────────────
-- سموذي
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 115 WHERE name_ar = 'ميكس بيري'   AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'بطيخ'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'تفاح أخضر'   AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'باشون فروت'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 120 WHERE name_ar = 'مانجو'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'بلوبيري'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 120 WHERE name_ar = 'كيوي'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'اناناس'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'فراولة'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'خوخ'          AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'ليمون نعناع'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'بلو اوشن'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'سموزي كولا', 'Cola Smoothie', 90, true
FROM categories c WHERE c.name_ar = 'سموذي'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'سموزي كولا' AND p.category_id = c.id);

-- ────────────────────────────────────────────────────────────────
-- عصير طازة
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 110 WHERE name_ar = 'بلح'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'رمان'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'اناناس'      AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'جوافة'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'بطيخ'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'مانجو'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'فراولة'      AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 95  WHERE name_ar = 'برتقال'      AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 90  WHERE name_ar = 'ليمون'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 95  WHERE name_ar = 'ليمون نعناع' AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 90  WHERE name_ar = 'موز'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 125 WHERE name_ar = 'افوكادو'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'كيوي'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'عناب', 'Jujube Juice', 75, true
FROM categories c WHERE c.name_ar = 'عصير طازة'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'عناب' AND p.category_id = c.id);

-- ────────────────────────────────────────────────────────────────
-- كوكتيل
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 110 WHERE name_ar = 'فلوريدا (مانجو فراولة جوافة)'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);
UPDATE products SET price = 105 WHERE name_ar = 'روج (مانجو فراولة موز)'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'جرين لايت (جوافة ليمون نعناع)'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'ماجيك جرين (كيوي مانجو)'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'مانجو بيتش (مانجو خوخ باشون)'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);
UPDATE products SET price = 145 WHERE name_ar = 'هوريكان (مانجو افوكادو بلوبيري)'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);
UPDATE products SET price = 145 WHERE name_ar = 'إنرجي (افوكادو بلح مكسرات)'          AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);
UPDATE products SET price = 140 WHERE name_ar = 'باور (افوكادو مانجو مكسرات)'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);

-- ────────────────────────────────────────────────────────────────
-- مشروبات غازية
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 65  WHERE name_ar = 'فيروز'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'مشروبات غازية' LIMIT 1);
UPDATE products SET price = 65  WHERE name_ar = 'بيريل'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'مشروبات غازية' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ريد بول'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'مشروبات غازية' LIMIT 1);

-- إضافة منتجات غازية منفصلة
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'بيبسي',        'Pepsi',          50, true FROM categories c WHERE c.name_ar = 'مشروبات غازية' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'بيبسي'        AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'ميرندا تفاح',  'Mirinda Apple',  50, true FROM categories c WHERE c.name_ar = 'مشروبات غازية' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'ميرندا تفاح'  AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'ميرندا برتقال','Mirinda Orange', 50, true FROM categories c WHERE c.name_ar = 'مشروبات غازية' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'ميرندا برتقال' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'سفن أب',       'Seven Up',       50, true FROM categories c WHERE c.name_ar = 'مشروبات غازية' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'سفن أب'       AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'تويست',        'Twist',          50, true FROM categories c WHERE c.name_ar = 'مشروبات غازية' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'تويست'        AND p.category_id = c.id);

-- ────────────────────────────────────────────────────────────────
-- صودا
-- ────────────────────────────────────────────────────────────────
UPDATE products SET price = 95  WHERE name_ar = 'موهيتو كلاسيك'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET price = 140 WHERE name_ar = 'موهيتو ريد بول'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET price = 105 WHERE name_ar = 'موهيتو فروت'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET price = 160 WHERE name_ar = 'ريد بول ميكس'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET price = 95  WHERE name_ar = 'شيري كولا'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET price = 95  WHERE name_ar = 'صن شاين'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'صودا بلوبيري'    AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET price = 100 WHERE name_ar = 'صودا كيوي'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);

-- ────────────────────────────────────────────────────────────────
-- حلويات (bar)
-- ────────────────────────────────────────────────────────────────
-- أم علي
UPDATE products SET price = 100 WHERE name_ar = 'ام علي مكسرات'        AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ام علي بلح ومكسرات'   AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'ام علي نوتيلا'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 145 WHERE name_ar = 'ام علي فواكه'          AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'أم علي اسبيشيال', 'Om Ali Special', 125, true
FROM categories c WHERE c.name_ar = 'حلويات'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'أم علي اسبيشيال' AND p.category_id = c.id);

-- فروت سلاد
UPDATE products SET price = 120 WHERE name_ar = 'سلطة فواكه'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 130 WHERE name_ar = 'توتي فروتي'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 135 WHERE name_ar = 'زبادي فواكه قطع' AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'طبق فاكهة كبير', 'Large Fruit Plate', 300, true FROM categories c WHERE c.name_ar = 'حلويات' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'طبق فاكهة كبير' AND p.category_id = c.id);

-- آيس كريم
UPDATE products SET price = 95  WHERE name_ar = 'ايس كريم كلاسيك (3 سكوب)'                            AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'صنداي كلاسيك (كريمة+صوص+مكسرات)'                    AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 125 WHERE name_ar = 'صنداي سبيشيال (نوتيلا/اوريو/لوتس/بلوبيري/بستاشيو)'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'آيس كريم مريديان',       'Meridian Ice Cream', 95,  true FROM categories c WHERE c.name_ar = 'حلويات' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'آيس كريم مريديان'      AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'صنداي مريديان',          'Meridian Sundae',    100, true FROM categories c WHERE c.name_ar = 'حلويات' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'صنداي مريديان'         AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'آيس كريم فروت',          'Fruit Ice Cream',    110, true FROM categories c WHERE c.name_ar = 'حلويات' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'آيس كريم فروت'         AND p.category_id = c.id);

-- وافل
UPDATE products SET price = 110 WHERE name_ar = 'وافل نوتيلا'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 120 WHERE name_ar = 'وافل نوتيلا و لوتس' AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'وافل لوتس'          AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'وافل شوكولاتة'      AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 120 WHERE name_ar = 'وافل اوريو'         AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 150 WHERE name_ar = 'وافل فور سيزون'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

INSERT INTO products (category_id, name_ar, name_en, price, is_available)
SELECT c.id, 'وافل فروت', 'Fruit Waffle', 150, true
FROM categories c WHERE c.name_ar = 'حلويات'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'وافل فروت' AND p.category_id = c.id);

-- ديزرت / كيك
UPDATE products SET price = 110 WHERE name_ar = 'سان سيباستيان' AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 120 WHERE name_ar = 'مولتن كيك'     AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 110 WHERE name_ar = 'كيك شوكولاتة'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET price = 115 WHERE name_ar = 'تشيز كيك'      AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

-- زبادي
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'زبادي عسل',   'Honey Yogurt', 95,  true FROM categories c WHERE c.name_ar = 'حلويات' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'زبادي عسل'   AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'زبادي فواكه', 'Fruit Yogurt', 125, true FROM categories c WHERE c.name_ar = 'حلويات' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'زبادي فواكه' AND p.category_id = c.id);


-- ================================================================
-- PART 2 — إضافة تصنيفات جديدة
-- ================================================================
INSERT INTO categories (name_ar, name_en, sort_order, department)
SELECT 'إضافات البار', 'Bar Add-ons', 27, 'bar'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_ar = 'إضافات البار');

INSERT INTO categories (name_ar, name_en, sort_order, department)
SELECT 'مشروبات الاستاف', 'Staff Drinks', 28, 'bar'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_ar = 'مشروبات الاستاف');

INSERT INTO categories (name_ar, name_en, sort_order, department)
SELECT 'عروض', 'Offers', 29, 'bar'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_ar = 'عروض');

INSERT INTO categories (name_ar, name_en, sort_order, department)
SELECT 'بان كيك', 'Pancake', 30, 'bar'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_ar = 'بان كيك');


-- ================================================================
-- PART 3 — إضافة منتجات للتصنيفات الجديدة
-- ================================================================

-- إضافات البار
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'عسل ومكسرات',    'Honey & Nuts',  35, true FROM categories c WHERE c.name_ar = 'إضافات البار' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'عسل ومكسرات'    AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'إضافة صوص',      'Add Sauce',     45, true FROM categories c WHERE c.name_ar = 'إضافات البار' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'إضافة صوص'      AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'إضافة آيس كريم', 'Add Ice Cream', 40, true FROM categories c WHERE c.name_ar = 'إضافات البار' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'إضافة آيس كريم' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'إضافة فاكهة',    'Add Fruit',     45, true FROM categories c WHERE c.name_ar = 'إضافات البار' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'إضافة فاكهة'    AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'إضافة ثلج',      'Add Ice',       10, true FROM categories c WHERE c.name_ar = 'إضافات البار' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'إضافة ثلج'      AND p.category_id = c.id);

-- مشروبات الاستاف
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'قهوة استاف', 'Staff Coffee', 0, true FROM categories c WHERE c.name_ar = 'مشروبات الاستاف' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'قهوة استاف' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'شاي استاف',  'Staff Tea',    0, true FROM categories c WHERE c.name_ar = 'مشروبات الاستاف' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'شاي استاف'  AND p.category_id = c.id);

-- عروض
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'ديزرت مع قهوة تركي', 'Dessert + Turkish Coffee', 150, true FROM categories c WHERE c.name_ar = 'عروض' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'ديزرت مع قهوة تركي' AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'ديزرت مع شاي',       'Dessert + Tea',            140, true FROM categories c WHERE c.name_ar = 'عروض' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'ديزرت مع شاي'       AND p.category_id = c.id);

-- بان كيك
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'بان كيك نوتيلا',    'Nutella Pancake',    115, true FROM categories c WHERE c.name_ar = 'بان كيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'بان كيك نوتيلا'    AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'بان كيك لوتس',      'Lotus Pancake',      110, true FROM categories c WHERE c.name_ar = 'بان كيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'بان كيك لوتس'      AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'بان كيك بيستاشيو',  'Pistachio Pancake',  120, true FROM categories c WHERE c.name_ar = 'بان كيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'بان كيك بيستاشيو'  AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'بان كيك كراميل',    'Caramel Pancake',    110, true FROM categories c WHERE c.name_ar = 'بان كيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'بان كيك كراميل'    AND p.category_id = c.id);
INSERT INTO products (category_id, name_ar, name_en, price, is_available) SELECT c.id, 'بان كيك أوريو',     'Oreo Pancake',       115, true FROM categories c WHERE c.name_ar = 'بان كيك' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'بان كيك أوريو'     AND p.category_id = c.id);

COMMIT;
