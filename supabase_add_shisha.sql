-- إضافة قسم "الشيش" للبار + منتجاته (شغّله مرة واحدة في Supabase SQL Editor)

BEGIN;

-- التصنيف (لو مش موجود)
INSERT INTO categories (name_ar, name_en, sort_order, department)
SELECT 'الشيش', 'Shisha', 27, 'bar'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_ar = 'الشيش');

-- المنتجات
INSERT INTO products (category_id, name_ar, name_en, price, image_url, is_available)
SELECT (SELECT id FROM categories WHERE name_ar = 'الشيش' LIMIT 1), v.name_ar, v.name_en, v.price, NULL, true
FROM (VALUES
  ('شيشة كيوي', 'Kiwi Shisha', 110),
  ('شيشة تويست', 'Twist Shisha', 110),
  ('شيشة ليمون نعناع', 'Lemon Mint Shisha', 110),
  ('شيشة نعناع', 'Mint Shisha', 110),
  ('شيشة بلو بيري', 'Blueberry Shisha', 110),
  ('شيشة مانجا', 'Mango Shisha', 110),
  ('شيشة خوخ', 'Peach Shisha', 110),
  ('شيشة تفاح', 'Apple Shisha', 110),
  ('شيشة كيوي مانجا', 'Kiwi Mango Shisha', 110),
  ('شيشة علب', 'Cans Shisha', 110),
  ('شيشة علب اسود', 'Black Cans Shisha', 110),
  ('شيشة علب نعناع', 'Mint Cans Shisha', 110),
  ('شيشة كولا', 'Cola Shisha', 110),
  ('شيشة كانتلوب', 'Cantaloupe Shisha', 110),
  ('شيشة بطيخ', 'Watermelon Shisha', 110),
  ('شيشة فصول', 'Fasool Shisha', 110),
  ('شيشة مكس', 'Mix Shisha', 110),
  ('شيشة مريديان', 'Meridian Shisha', 100),
  ('شيشة VIP', 'VIP Shisha', 110),
  ('شيشة فراولة', 'Strawberry Shisha', 70),
  ('شيشة فرنساوي', 'French Shisha', 65),
  ('شيشة سلوم', 'Sloom Shisha', 25),
  ('لية طبي', 'Medical Hose Tip', 25),
  ('معسل الحاج فاروق', 'Al-Hajj Farouk Molasses', 1),
  ('الحاج فاروق VIP', 'Al-Hajj Farouk VIP', 1)
) AS v(name_ar, name_en, price);

COMMIT;
