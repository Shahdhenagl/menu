-- ================================================================
-- Patch v31: تحديث أسعار طلبات (talabat_price) — مطبخ + بار
-- نفّذه في: Supabase SQL Editor
-- ================================================================

BEGIN;

-- ================================================================
-- PART 1 — مطبخ (Restaurant) — talabat_price
-- ================================================================

-- ── الشوربة ──────────────────────────────────────────────────────
UPDATE products SET talabat_price = 190 WHERE name_ar = 'شوربة كريمة الدجاج بالبندق'  AND category_id = (SELECT id FROM categories WHERE name_ar = 'الشوربة' LIMIT 1);
UPDATE products SET talabat_price = 170 WHERE name_ar ILIKE '%برافا%'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'الشوربة' LIMIT 1);
UPDATE products SET talabat_price = 380 WHERE name_ar ILIKE '%سي فود%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'الشوربة' LIMIT 1);
UPDATE products SET talabat_price = 125 WHERE name_ar ILIKE '%تورتيلا%'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'الشوربة' LIMIT 1);

-- ── المقبلات والأطفال (شامل الطاسات) ────────────────────────────
UPDATE products SET talabat_price = 195 WHERE name_ar ILIKE '%تشكن كرسبي%جبنة%'       AND category_id = (SELECT id FROM categories WHERE name_ar = 'المقبلات والأطفال' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar ILIKE '%بطاطس جبنة%'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'المقبلات والأطفال' LIMIT 1);
UPDATE products SET talabat_price = 65  WHERE name_ar = 'بطاطس كلاسيك'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'المقبلات والأطفال' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'تشكن ناجتس'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'المقبلات والأطفال' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar ILIKE '%موتزريلا%'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'المقبلات والأطفال' LIMIT 1);
UPDATE products SET talabat_price = 245 WHERE name_ar = 'تشكن كساديا'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'المقبلات والأطفال' LIMIT 1);
UPDATE products SET talabat_price = 170 WHERE name_ar = 'تشكن استربس'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'المقبلات والأطفال' LIMIT 1);

-- ── السلطات ──────────────────────────────────────────────────────
UPDATE products SET talabat_price = 125 WHERE name_ar = 'جريك سلاد'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'السلطات' LIMIT 1);
UPDATE products SET talabat_price = 195 WHERE name_ar ILIKE '%سيزر%'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'السلطات' LIMIT 1);
UPDATE products SET talabat_price = 210 WHERE name_ar ILIKE '%فروت سلاد%'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'السلطات' LIMIT 1);
UPDATE products SET talabat_price = 180 WHERE name_ar ILIKE '%رانش كورن%'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'السلطات' LIMIT 1);

-- ── البيتزا ──────────────────────────────────────────────────────
UPDATE products SET talabat_price = 155 WHERE name_ar ILIKE '%مارجريتا%'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);
UPDATE products SET talabat_price = 310 WHERE name_ar ILIKE '%سوبريم%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);
UPDATE products SET talabat_price = 280 WHERE name_ar ILIKE '%ماك تشيز%'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);
UPDATE products SET talabat_price = 265 WHERE name_ar ILIKE '%ميلانو%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);
UPDATE products SET talabat_price = 310 WHERE name_ar ILIKE '%باربكيو%'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);
UPDATE products SET talabat_price = 280 WHERE name_ar ILIKE '%رانش%'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);
UPDATE products SET talabat_price = 450 WHERE name_ar ILIKE '%سي فود%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);
UPDATE products SET talabat_price = 390 WHERE name_ar ILIKE '%جمبري%'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'البيتزا' LIMIT 1);

-- ── الباستا ──────────────────────────────────────────────────────
UPDATE products SET talabat_price = 125 WHERE name_ar ILIKE '%بنا%خضار%'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'الباستا' LIMIT 1);
UPDATE products SET talabat_price = 265 WHERE name_ar ILIKE '%الفريدو%'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'الباستا' LIMIT 1);
UPDATE products SET talabat_price = 295 WHERE name_ar ILIKE '%نجرسكو%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'الباستا' LIMIT 1);
UPDATE products SET talabat_price = 310 WHERE name_ar ILIKE '%دوريتوس%'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'الباستا' LIMIT 1);
UPDATE products SET talabat_price = 280 WHERE name_ar ILIKE '%ماك تشيز%'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'الباستا' LIMIT 1);
UPDATE products SET talabat_price = 350 WHERE name_ar ILIKE '%جمبري%ليمون%'            AND category_id = (SELECT id FROM categories WHERE name_ar = 'الباستا' LIMIT 1);
UPDATE products SET talabat_price = 420 WHERE name_ar ILIKE '%سي فود%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'الباستا' LIMIT 1);

-- ── البرجر ───────────────────────────────────────────────────────
UPDATE products SET talabat_price = 210 WHERE name_ar = 'تشكن برجر'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'البرجر' LIMIT 1);
UPDATE products SET talabat_price = 250 WHERE name_ar ILIKE '%فادج%'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'البرجر' LIMIT 1);
UPDATE products SET talabat_price = 250 WHERE name_ar = 'كلاسيك برجر'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'البرجر' LIMIT 1);
UPDATE products SET talabat_price = 280 WHERE name_ar ILIKE '%ميريديان%'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'البرجر' LIMIT 1);
UPDATE products SET talabat_price = 265 WHERE name_ar ILIKE '%ديولكس%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'البرجر' LIMIT 1);

-- ── الساندويتشات ─────────────────────────────────────────────────
UPDATE products SET talabat_price = 250 WHERE name_ar ILIKE '%زنجر%'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'الساندويتشات' LIMIT 1);
UPDATE products SET talabat_price = 250 WHERE name_ar ILIKE '%فاهيتا%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'الساندويتشات' LIMIT 1);
UPDATE products SET talabat_price = 230 WHERE name_ar ILIKE '%كريسبي%'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'الساندويتشات' LIMIT 1);
UPDATE products SET talabat_price = 250 WHERE name_ar ILIKE '%شيش طاووق%'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'الساندويتشات' LIMIT 1);
UPDATE products SET talabat_price = 210 WHERE name_ar ILIKE '%كفتة%'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'الساندويتشات' LIMIT 1);
UPDATE products SET talabat_price = 315 WHERE name_ar ILIKE '%جمبري%'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'الساندويتشات' LIMIT 1);

-- ── الركن الشرقي ─────────────────────────────────────────────────
UPDATE products SET talabat_price = 450 WHERE name_ar ILIKE '%سمان%'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'الركن الشرقي' LIMIT 1);
UPDATE products SET talabat_price = 420 WHERE name_ar = 'فراخ مسحب'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'الركن الشرقي' LIMIT 1);
UPDATE products SET talabat_price = 435 WHERE name_ar = 'كفتة'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'الركن الشرقي' LIMIT 1);
UPDATE products SET talabat_price = 420 WHERE name_ar ILIKE '%شيش طاووق%'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'الركن الشرقي' LIMIT 1);
UPDATE products SET talabat_price = 435 WHERE name_ar ILIKE '%ميكس شيش%'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'الركن الشرقي' LIMIT 1);
UPDATE products SET talabat_price = 630 WHERE name_ar ILIKE '%ميكس%جريل%'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'الركن الشرقي' LIMIT 1);


-- ================================================================
-- PART 2 — بار (Bar) — talabat_price
-- ================================================================

-- ── حلويات — فروت سلاد ───────────────────────────────────────────
UPDATE products SET talabat_price = 150 WHERE name_ar = 'سلطة فواكه'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

-- ── مشروبات غازية ────────────────────────────────────────────────
UPDATE products SET talabat_price = 60  WHERE name_ar = 'بيبسي'                        AND category_id = (SELECT id FROM categories WHERE name_ar = 'مشروبات غازية' LIMIT 1);
UPDATE products SET talabat_price = 15  WHERE name_ar = 'مياه معدنية'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'مشروبات غازية' LIMIT 1);

-- ── فرابيه (كل الأنواع = 150) ────────────────────────────────────
UPDATE products SET talabat_price = 150
WHERE category_id = (SELECT id FROM categories WHERE name_ar = 'فرابيه' LIMIT 1);

-- ── كوكتيل ───────────────────────────────────────────────────────
UPDATE products SET talabat_price = 170 WHERE name_ar ILIKE '%باور%'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'كوكتيل' LIMIT 1);

-- ── سموذي (كل الأنواع المذكورة = 150) ────────────────────────────
UPDATE products SET talabat_price = 150 WHERE name_ar = 'ميكس بيري'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'بطيخ'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'باشون فروت'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'مانجو'                        AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'بلوبيري'                      AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'كيوي'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'اناناس'                       AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'فراولة'                       AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'خوخ'                          AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'ليمون نعناع'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'سموذي' LIMIT 1);

-- ── صودا ─────────────────────────────────────────────────────────
UPDATE products SET talabat_price = 170 WHERE name_ar = 'ريد بول ميكس'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET talabat_price = 130 WHERE name_ar = 'موهيتو كلاسيك'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET talabat_price = 170 WHERE name_ar = 'موهيتو ريد بول'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET talabat_price = 130 WHERE name_ar = 'موهيتو فروت'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);
UPDATE products SET talabat_price = 130 WHERE name_ar = 'صودا بلوبيري'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'صودا' LIMIT 1);

-- صودا كولا (منتج جديد تحت صودا)
INSERT INTO products (category_id, name_ar, name_en, price, talabat_price, is_available)
SELECT c.id, 'صودا كولا', 'Soda Cola', 95, 130, true
FROM categories c WHERE c.name_ar = 'صودا'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name_ar = 'صودا كولا' AND p.category_id = c.id);

-- ── عصير طازة ────────────────────────────────────────────────────
UPDATE products SET talabat_price = 130 WHERE name_ar = 'بلح'                          AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 120 WHERE name_ar = 'بطيخ'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 100 WHERE name_ar = 'عناب'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 130 WHERE name_ar = 'مانجو'                        AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 130 WHERE name_ar = 'فراولة'                       AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 105 WHERE name_ar = 'برتقال'                       AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 100 WHERE name_ar = 'ليمون'                        AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 110 WHERE name_ar = 'ليمون نعناع'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 110 WHERE name_ar = 'موز'                          AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'افوكادو'                      AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'كيوي'                         AND category_id = (SELECT id FROM categories WHERE name_ar = 'عصير طازة' LIMIT 1);

-- ── حلويات — ديزرت ───────────────────────────────────────────────
UPDATE products SET talabat_price = 140 WHERE name_ar = 'سان سيباستيان'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 145 WHERE name_ar = 'مولتن كيك'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 125 WHERE name_ar = 'كيك شوكولاتة'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 135 WHERE name_ar = 'تشيز كيك'                    AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

-- ── حلويات — وافل ────────────────────────────────────────────────
UPDATE products SET talabat_price = 150 WHERE name_ar = 'وافل نوتيلا'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 160 WHERE name_ar = 'وافل نوتيلا و لوتس'          AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'وافل لوتس'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'وافل شوكولاتة'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 155 WHERE name_ar = 'وافل اوريو'                  AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 180 WHERE name_ar = 'وافل فروت'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 190 WHERE name_ar = 'وافل فور سيزون'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

-- ── ميلك شيك ─────────────────────────────────────────────────────
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك تشيز (نوتيلا/لوتس/بيستاشيو/كيندر)' AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك فانيليا'            AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك تشوكلت'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك مانجو'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك فراولة'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك كراميل'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك بلوبيري'            AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك اوريو'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك لوتس'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ميلك شيك نوتيلا'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);
UPDATE products SET talabat_price = 170 WHERE name_ar = 'ميلك شيك بيستاشيو'           AND category_id = (SELECT id FROM categories WHERE name_ar = 'ميلك شيك' LIMIT 1);

-- ── بان كيك (كل الأنواع = 145 عدا بيستاشيو) ──────────────────────
UPDATE products SET talabat_price = 145 WHERE name_ar = 'بان كيك نوتيلا'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'بان كيك' LIMIT 1);
UPDATE products SET talabat_price = 145 WHERE name_ar = 'بان كيك لوتس'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'بان كيك' LIMIT 1);
UPDATE products SET talabat_price = 145 WHERE name_ar = 'بان كيك بيستاشيو'            AND category_id = (SELECT id FROM categories WHERE name_ar = 'بان كيك' LIMIT 1);
UPDATE products SET talabat_price = 145 WHERE name_ar = 'بان كيك كراميل'              AND category_id = (SELECT id FROM categories WHERE name_ar = 'بان كيك' LIMIT 1);
UPDATE products SET talabat_price = 145 WHERE name_ar = 'بان كيك أوريو'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'بان كيك' LIMIT 1);

-- ── حلويات — زبادي ───────────────────────────────────────────────
UPDATE products SET talabat_price = 120 WHERE name_ar = 'زبادي عسل'                   AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 160 WHERE name_ar = 'زبادي فواكه قطع'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 160 WHERE name_ar = 'زبادي فواكه'                 AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

-- ── حلويات — أم علي ──────────────────────────────────────────────
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ام علي مكسرات'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 150 WHERE name_ar = 'ام علي بلح ومكسرات'          AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 175 WHERE name_ar = 'أم علي اسبيشيال'             AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 140 WHERE name_ar = 'ام علي نوتيلا'               AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);
UPDATE products SET talabat_price = 185 WHERE name_ar = 'ام علي فواكه'                AND category_id = (SELECT id FROM categories WHERE name_ar = 'حلويات' LIMIT 1);

COMMIT;
