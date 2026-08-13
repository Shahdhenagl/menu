-- إضافة عملاء الحسابات الآجلة إلى إدارة العملاء
-- شغّل الملف من Supabase SQL Editor بعد تعديل بيانات قسم seed_customers فقط.
-- السكربت لا يكرر العميل إذا كان رقم الهاتف موجودًا بالفعل.

BEGIN;

-- تأكيد وجود الأعمدة المطلوبة لإدارة العملاء والحسابات الآجلة.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS total_debt NUMERIC NOT NULL DEFAULT 0;

-- بيانات العملاء أصحاب الحسابات الآجلة.
-- عدّل أو أضف الصفوف التالية:
WITH seed_customers (name, phone, opening_debt) AS (
  VALUES
    ('اسم العميل الأول', '01000000001', 500.00),
    ('اسم العميل الثاني', '01000000002', 750.00)
),
normalized AS (
  SELECT
    trim(name)::text AS name,
    NULLIF(regexp_replace(trim(phone), '[^0-9+]', '', 'g'), '')::text AS phone,
    GREATEST(opening_debt::numeric, 0) AS opening_debt
  FROM seed_customers
  WHERE NULLIF(trim(name), '') IS NOT NULL
    AND NULLIF(regexp_replace(trim(phone), '[^0-9+]', '', 'g'), '') IS NOT NULL
), inserted AS (
  INSERT INTO public.customers (name, phone, total_debt)
  SELECT n.name, n.phone, n.opening_debt
  FROM normalized n
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE regexp_replace(COALESCE(c.phone, ''), '[^0-9+]', '', 'g') = n.phone
  )
  RETURNING id, name, phone, total_debt
)
SELECT * FROM inserted;

COMMIT;

-- التحقق من العملاء أصحاب المديونيات:
SELECT id, name, phone, total_debt, created_at
FROM public.customers
WHERE COALESCE(total_debt, 0) > 0
ORDER BY created_at DESC;

/*
مهم:
- إذا كان العميل موجودًا بالفعل، السكربت لا يضيف عليه الرصيد مرة ثانية.
- إذا أردت تعديل رصيد عميل موجود، استخدم هذا الاستعلام بشكل منفصل بعد تغيير القيم:

UPDATE public.customers
SET total_debt = 500.00
WHERE phone = '01000000001';

- لا تستخدم هذا UPDATE لإضافة دفعة تحصيل؛ تحصيل المديونية يجب أن يتم من شاشة التحصيل حتى يتم تسجيل customer_payment وتظهر العملية في التقارير وتقفيل الشيفت.
*/

-- فحص العملاء الذين لديهم رصيد آجل لكن رقم هاتفهم مفقود:
SELECT id, name, phone, total_debt
FROM public.customers
WHERE COALESCE(total_debt, 0) > 0
  AND NULLIF(trim(COALESCE(phone, '')), '') IS NULL;

-- فحص العملاء المتكررين بنفس رقم الهاتف قبل اعتماد البيانات:
SELECT phone, COUNT(*) AS duplicate_count
FROM public.customers
WHERE NULLIF(trim(COALESCE(phone, '')), '') IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1;

-- فهارس تساعد إدارة العملاء والحسابات الآجلة.
CREATE INDEX IF NOT EXISTS idx_customers_total_debt
  ON public.customers (total_debt);

CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON public.customers (phone);

-- ملاحظة RLS:
-- إذا كانت شاشة الإدارة لا تقرأ العملاء بعد تشغيل السكربت، تأكد من تشغيل صلاحيات customers الموجودة في schema/patch السابق.
-- لا يتم تعطيل RLS هنا بشكل تلقائي حفاظًا على أمان بيانات العملاء.

-- أمثلة جاهزة بعد استبدال البيانات:
-- ('أحمد محمد', '01123456789', 1250.00),
-- ('محمود علي', '01234567890', 300.00),
-- ('سارة حسن', '01098765432', 875.50)

-- انتهى السكربت.
-- بعد التشغيل اعمل Reload للموقع، وسيظهر العملاء في إدارة العملاء والحسابات الآجلة.
