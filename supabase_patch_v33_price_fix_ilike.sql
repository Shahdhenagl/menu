-- ================================================================
-- Patch v33: إعادة تطبيق تحديث الأسعار بـ ILIKE (حل مشكلة الإملاء)
-- نفّذه في: Supabase SQL Editor
-- ================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════
-- شاي
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 35  WHERE name_ar ILIKE '%شاي%'         AND name_ar NOT ILIKE '%نعناع%' AND name_ar NOT ILIKE '%أخضر%' AND name_ar NOT ILIKE '%كرك%' AND name_ar NOT ILIKE '%براد%' AND name_ar NOT ILIKE '%قرنفل%' AND name_ar NOT ILIKE '%نكهات%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');
UPDATE products SET price = 40  WHERE name_ar ILIKE '%نعناع%'       AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');
UPDATE products SET price = 40  WHERE name_ar ILIKE '%أخضر%'        AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');
UPDATE products SET price = 40  WHERE name_ar ILIKE '%قرنفل%'       AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');
UPDATE products SET price = 40  WHERE name_ar ILIKE '%نكهات%'       AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');
UPDATE products SET price = 45  WHERE name_ar ILIKE '%براد%صغير%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');
UPDATE products SET price = 65  WHERE name_ar ILIKE '%براد%كبير%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');
UPDATE products SET price = 65  WHERE name_ar ILIKE '%كرك%'         AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شاي%');

-- ════════════════════════════════════════════════════════════════
-- كافيين
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 45  WHERE name_ar ILIKE '%اسبريسو%'     AND name_ar ILIKE '%سنجل%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 55  WHERE name_ar ILIKE '%اسبريسو%'     AND name_ar ILIKE '%دبل%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 45  WHERE name_ar ILIKE '%إسبريسو%'     AND name_ar ILIKE '%سنجل%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 55  WHERE name_ar ILIKE '%إسبريسو%'     AND name_ar ILIKE '%دبل%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 80  WHERE name_ar ILIKE '%هابي%'        AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 70  WHERE name_ar ILIKE '%ميكاتو%'      AND name_ar NOT ILIKE '%ايس%' AND name_ar NOT ILIKE '%آيس%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 70  WHERE name_ar ILIKE '%كورتادو%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 85  WHERE name_ar ILIKE '%فلات وايت%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 85  WHERE name_ar ILIKE '%كابتشينو%'    AND name_ar NOT ILIKE '%فليفر%' AND name_ar NOT ILIKE '%فلفر%' AND name_ar NOT ILIKE '%ايس%' AND name_ar NOT ILIKE '%آيس%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 90  WHERE name_ar ILIKE '%كابتشينو%'    AND (name_ar ILIKE '%فليفر%' OR name_ar ILIKE '%فلفر%') AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 85  WHERE name_ar ILIKE '%لاتيه%'       AND name_ar NOT ILIKE '%سبانش%' AND name_ar NOT ILIKE '%ايس%' AND name_ar NOT ILIKE '%آيس%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%سبانش لاتيه%' AND name_ar NOT ILIKE '%ايس%' AND name_ar NOT ILIKE '%آيس%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 75  WHERE name_ar ILIKE '%امريكانو%'    AND name_ar NOT ILIKE '%ايس%' AND name_ar NOT ILIKE '%آيس%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 75  WHERE name_ar ILIKE '%أمريكانو%'    AND name_ar NOT ILIKE '%ايس%' AND name_ar NOT ILIKE '%آيس%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%موكا%'         AND name_ar NOT ILIKE '%ايس%' AND name_ar NOT ILIKE '%آيس%' AND name_ar NOT ILIKE '%كريزي%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 55  WHERE name_ar ILIKE '%كوفي ميكس%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%كريزي موكا%'  AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 95  WHERE name_ar ILIKE '%امريكان كوفي%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 85  WHERE name_ar ILIKE '%نسكافيه%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 75  WHERE name_ar ILIKE '%سينابون%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');
UPDATE products SET price = 75  WHERE name_ar ILIKE '%حمص الشام%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%كافيين%');

-- ════════════════════════════════════════════════════════════════
-- أعشاب
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 40 WHERE category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%أعشاب%' OR name_ar ILIKE '%اعشاب%');

-- ════════════════════════════════════════════════════════════════
-- قهوة
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 40 WHERE name_ar ILIKE '%تركي%'     AND name_ar ILIKE '%سنجل%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%قهوة%');
UPDATE products SET price = 45 WHERE name_ar ILIKE '%تركي%'     AND name_ar ILIKE '%دبل%'  AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%قهوة%');
UPDATE products SET price = 50 WHERE name_ar ILIKE '%فرنساوي%'  AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%قهوة%');
UPDATE products SET price = 55 WHERE name_ar ILIKE '%بندق%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%قهوة%');

-- ════════════════════════════════════════════════════════════════
-- هوت شوكليت
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 85 WHERE name_ar ILIKE '%كلاسيك%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شوكليت%' OR name_ar ILIKE '%شوكولاتة%');
UPDATE products SET price = 95 WHERE name_ar ILIKE '%نوتيلا%'  AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شوكليت%' OR name_ar ILIKE '%شوكولاتة%');
UPDATE products SET price = 95 WHERE name_ar ILIKE '%لوتس%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%شوكليت%' OR name_ar ILIKE '%شوكولاتة%');

-- ════════════════════════════════════════════════════════════════
-- سحلب
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 90 WHERE name_ar ILIKE '%سحلب%' AND name_ar ILIKE '%مكسرات%';

-- ════════════════════════════════════════════════════════════════
-- آيس  (يغطي: ايس / آيس / أيس)
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 90  WHERE name_ar ILIKE '%امريكانو%'    AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 90  WHERE name_ar ILIKE '%أمريكانو%'    AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%سبانش%'       AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 105 WHERE name_ar ILIKE '%ميكاتو%'      AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%نوتيلا%'      AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%لاتيه%'       AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%') AND name_ar NOT ILIKE '%سبانش%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%موكا%'         AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 105 WHERE name_ar ILIKE '%كابتشينو%'    AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 105 WHERE name_ar ILIKE '%كراميل%'      AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 105 WHERE name_ar ILIKE '%تشوكليت%'     AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');
UPDATE products SET price = 105 WHERE name_ar ILIKE '%شوكولاتة%'    AND (name_ar ILIKE '%ايس%' OR name_ar ILIKE '%آيس%');

-- ════════════════════════════════════════════════════════════════
-- ميلك شيك
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 110 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%فانيل%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%ميلك شيك%' AND (name_ar ILIKE '%تشوكليت%' OR name_ar ILIKE '%شوكولاتة%' OR name_ar ILIKE '%تشوكلت%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%فراولة%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%مانجو%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%كراميل%';
UPDATE products SET price = 105 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%بلوبيري%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%ميلك شيك%' AND (name_ar ILIKE '%اوريو%' OR name_ar ILIKE '%أوريو%');
UPDATE products SET price = 105 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%لوتس%';
UPDATE products SET price = 105 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%نوتيلا%';
UPDATE products SET price = 120 WHERE name_ar ILIKE '%ميلك شيك%' AND name_ar ILIKE '%بيستاشيو%';
UPDATE products SET price = 120 WHERE name_ar ILIKE '%ميلك تشيز%';

-- ════════════════════════════════════════════════════════════════
-- فرابيه
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 100 WHERE name_ar ILIKE '%فرابيه%' AND name_ar ILIKE '%كوفي%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%فرابيه%' AND name_ar ILIKE '%كراميل%';
UPDATE products SET price = 100 WHERE name_ar ILIKE '%فرابيه%' AND name_ar ILIKE '%فانيل%';
UPDATE products SET price = 100 WHERE name_ar ILIKE '%فرابيه%' AND (name_ar ILIKE '%تشوكلت%' OR name_ar ILIKE '%شيكولاتة%' OR name_ar ILIKE '%شوكولاتة%');
UPDATE products SET price = 115 WHERE name_ar ILIKE '%فرابيه%' AND name_ar ILIKE '%نوتيلا%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%فرابيه%' AND name_ar ILIKE '%لوتس%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%فرابيه%' AND name_ar ILIKE '%بندق%';

-- ════════════════════════════════════════════════════════════════
-- سموذي
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 115 WHERE name_ar ILIKE '%بيري%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%بطيخ%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%باشون%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%تفاح%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 120 WHERE name_ar ILIKE '%مانجو%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 115 WHERE name_ar ILIKE '%بلوبيري%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 120 WHERE name_ar ILIKE '%كيوي%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 115 WHERE name_ar ILIKE '%اناناس%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%فراولة%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%خوخ%'       AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%ليمون نعناع%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');
UPDATE products SET price = 115 WHERE name_ar ILIKE '%بلو اوشن%'  AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%سموذي%' OR name_ar ILIKE '%سموزي%');

-- ════════════════════════════════════════════════════════════════
-- عصير طازة
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 110 WHERE name_ar ILIKE '%بلح%'       AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%رمان%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 110 WHERE name_ar ILIKE '%اناناس%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%جوافة%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%بطيخ%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 115 WHERE name_ar ILIKE '%مانجو%'     AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 100 WHERE name_ar ILIKE '%فراولة%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 95  WHERE name_ar ILIKE '%برتقال%'    AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 90  WHERE name_ar ILIKE '%ليمون%'     AND name_ar NOT ILIKE '%نعناع%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 95  WHERE name_ar ILIKE '%ليمون نعناع%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 90  WHERE name_ar ILIKE '%موز%'       AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 125 WHERE name_ar ILIKE '%افوكادو%'   AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 115 WHERE name_ar ILIKE '%كيوي%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');
UPDATE products SET price = 75  WHERE name_ar ILIKE '%عناب%'      AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%عصير%');

-- ════════════════════════════════════════════════════════════════
-- كوكتيل
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 110 WHERE name_ar ILIKE '%فلوريدا%';
UPDATE products SET price = 105 WHERE name_ar ILIKE '%روج%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%جرين لايت%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%ماجيك%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%مانجو بيتش%';
UPDATE products SET price = 145 WHERE name_ar ILIKE '%هوريكان%';
UPDATE products SET price = 145 WHERE name_ar ILIKE '%انرجي%' OR name_ar ILIKE '%إنرجي%';
UPDATE products SET price = 140 WHERE name_ar ILIKE '%باور%';

-- ════════════════════════════════════════════════════════════════
-- مشروبات غازية
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 65  WHERE name_ar ILIKE '%فيروز%';
UPDATE products SET price = 65  WHERE name_ar ILIKE '%بيريل%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%ريد بول%' AND category_id IN (SELECT id FROM categories WHERE name_ar ILIKE '%غازية%');
UPDATE products SET price = 50  WHERE name_ar ILIKE '%بيبسي%';
UPDATE products SET price = 50  WHERE name_ar ILIKE '%ميرندا%';
UPDATE products SET price = 50  WHERE name_ar ILIKE '%سفن%';
UPDATE products SET price = 50  WHERE name_ar ILIKE '%تويست%';
UPDATE products SET price = 15  WHERE name_ar ILIKE '%مياه%';

-- ════════════════════════════════════════════════════════════════
-- صودا
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 95  WHERE name_ar ILIKE '%موهيتو%'     AND name_ar ILIKE '%كلاسيك%';
UPDATE products SET price = 140 WHERE name_ar ILIKE '%موهيتو%'     AND name_ar ILIKE '%ريد بول%';
UPDATE products SET price = 105 WHERE name_ar ILIKE '%موهيتو%'     AND name_ar ILIKE '%فروت%';
UPDATE products SET price = 160 WHERE name_ar ILIKE '%ريد بول ميكس%';
UPDATE products SET price = 95  WHERE name_ar ILIKE '%شيري كولا%';
UPDATE products SET price = 95  WHERE name_ar ILIKE '%صن شاين%';
UPDATE products SET price = 100 WHERE name_ar ILIKE '%صودا بلوبيري%';
UPDATE products SET price = 100 WHERE name_ar ILIKE '%صودا كيوي%';

-- ════════════════════════════════════════════════════════════════
-- حلويات — أم علي
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 100 WHERE name_ar ILIKE '%ام علي%'   AND name_ar ILIKE '%مكسرات%' AND name_ar NOT ILIKE '%بلح%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%ام علي%'   AND name_ar ILIKE '%بلح%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%ام علي%'   AND name_ar ILIKE '%نوتيلا%';
UPDATE products SET price = 145 WHERE name_ar ILIKE '%ام علي%'   AND name_ar ILIKE '%فواكه%';
UPDATE products SET price = 125 WHERE (name_ar ILIKE '%ام علي%' OR name_ar ILIKE '%أم علي%') AND name_ar ILIKE '%اسبيشيال%';

-- ════════════════════════════════════════════════════════════════
-- حلويات — فروت سلاد
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 120 WHERE name_ar ILIKE '%سلطة فواكه%';
UPDATE products SET price = 130 WHERE name_ar ILIKE '%توتي فروت%';
UPDATE products SET price = 135 WHERE name_ar ILIKE '%زبادي فواكه قطع%';

-- ════════════════════════════════════════════════════════════════
-- حلويات — آيس كريم
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 95  WHERE name_ar ILIKE '%ايس كريم%'  AND name_ar ILIKE '%كلاسيك%';
UPDATE products SET price = 95  WHERE name_ar ILIKE '%آيس كريم%'  AND name_ar ILIKE '%كلاسيك%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%صنداي%'     AND name_ar ILIKE '%كلاسيك%';
UPDATE products SET price = 125 WHERE name_ar ILIKE '%صنداي%'     AND name_ar ILIKE '%سبيشيال%';

-- ════════════════════════════════════════════════════════════════
-- حلويات — وافل
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 110 WHERE name_ar ILIKE '%وافل%' AND name_ar ILIKE '%نوتيلا%' AND name_ar NOT ILIKE '%لوتس%';
UPDATE products SET price = 120 WHERE name_ar ILIKE '%وافل%' AND name_ar ILIKE '%نوتيلا%' AND name_ar ILIKE '%لوتس%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%وافل%' AND name_ar ILIKE '%لوتس%'   AND name_ar NOT ILIKE '%نوتيلا%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%وافل%' AND (name_ar ILIKE '%شوكولاتة%' OR name_ar ILIKE '%شوكليت%');
UPDATE products SET price = 120 WHERE name_ar ILIKE '%وافل%' AND (name_ar ILIKE '%اوريو%' OR name_ar ILIKE '%أوريو%');
UPDATE products SET price = 150 WHERE name_ar ILIKE '%وافل%' AND name_ar ILIKE '%فور سيزون%';
UPDATE products SET price = 150 WHERE name_ar ILIKE '%وافل%' AND name_ar ILIKE '%فروت%';

-- ════════════════════════════════════════════════════════════════
-- حلويات — ديزرت / كيك
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 110 WHERE name_ar ILIKE '%سان%سيباستيان%' OR name_ar ILIKE '%سان سبيستيشان%';
UPDATE products SET price = 120 WHERE name_ar ILIKE '%مولتن كيك%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%كيك شوكولاتة%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%تشيز كيك%';

-- ════════════════════════════════════════════════════════════════
-- بان كيك
-- ════════════════════════════════════════════════════════════════
UPDATE products SET price = 115 WHERE name_ar ILIKE '%بان كيك%' AND name_ar ILIKE '%نوتيلا%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%بان كيك%' AND name_ar ILIKE '%لوتس%';
UPDATE products SET price = 120 WHERE name_ar ILIKE '%بان كيك%' AND name_ar ILIKE '%بيستاشيو%';
UPDATE products SET price = 110 WHERE name_ar ILIKE '%بان كيك%' AND name_ar ILIKE '%كراميل%';
UPDATE products SET price = 115 WHERE name_ar ILIKE '%بان كيك%' AND (name_ar ILIKE '%اوريو%' OR name_ar ILIKE '%أوريو%');

COMMIT;
