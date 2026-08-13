-- إضافة العملاء بالأرصدة الافتتاحية للآجل
-- الإجمالي المتوقع للأرصدة الافتتاحية: 10,514.00
-- هذا السكربت لا يغيّر عميلًا موجودًا بنفس الاسم، لذلك يمكن تشغيله أكثر من مرة بأمان.

BEGIN;

CREATE TEMP TABLE opening_customer_balances (
  customer_name TEXT NOT NULL,
  opening_balance NUMERIC(12,2) NOT NULL CHECK (opening_balance >= 0)
) ON COMMIT DROP;

INSERT INTO opening_customer_balances (customer_name, opening_balance) VALUES
  ('عمرو فهاد', 1067.00),
  ('إبراهيم أبو الخير', 296.00),
  ('علاء', 1359.00),
  ('محمد المحامي', 975.00),
  ('الزناتي', 2332.00),
  ('الحاج أحمد', 5.00),
  ('تاتا', 1130.00),
  ('حازم الوزير', 85.00),
  ('عبد عبده', 890.00),
  ('البيلي', 5.00),
  ('كريم البياع', 100.00),
  ('حسام سالم', 75.00),
  ('إسلام عبوده', 290.00),
  ('عطية', 770.00),
  ('الحجاج', 30.00),
  ('عمرو', 60.00),
  ('منصور شحاتة', 185.00),
  ('رامي بيك', 615.00),
  ('بيبو', 55.00),
  ('أحمد منصور', 190.00);

-- إضافة العملاء غير الموجودين فقط.
-- المطابقة تتم بالاسم بعد إزالة المسافات وتحويل الحروف إلى lowercase.
INSERT INTO customers (name, phone, total_debt)
SELECT src.customer_name, NULL, src.opening_balance
FROM opening_customer_balances src
WHERE NOT EXISTS (
  SELECT 1
  FROM customers existing
  WHERE lower(trim(existing.name)) = lower(trim(src.customer_name))
);

COMMIT;

-- مراجعة العملاء والأرصدة التي أصبحت موجودة.
SELECT name, total_debt
FROM customers
WHERE lower(trim(name)) IN (
  SELECT lower(trim(customer_name)) FROM opening_customer_balances
)
ORDER BY name;

-- مراجعة الإجمالي النهائي للعملاء الموجودين في الكشف.
SELECT COALESCE(SUM(total_debt), 0)::NUMERIC(12,2) AS opening_debt_total
FROM customers
WHERE lower(trim(name)) IN (
  SELECT lower(trim(customer_name)) FROM opening_customer_balances
);

-- يجب أن تكون النتيجة المتوقعة 10514.00 إذا لم تكن هناك أرصدة سابقة لهؤلاء العملاء.
