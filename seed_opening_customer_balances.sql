-- إضافة العملاء بالأرصدة الافتتاحية للآجل
-- الإجمالي المتوقع للأرصدة الافتتاحية: 10,514.00
-- السكربت آمن لإعادة التشغيل: لا يضيف العميل إذا كان موجودًا بنفس الاسم.

BEGIN;

WITH opening_customer_balances (customer_name, opening_balance) AS (
  VALUES
    ('عمرو فهاد', 1067.00::NUMERIC),
    ('إبراهيم أبو الخير', 296.00::NUMERIC),
    ('علاء', 1359.00::NUMERIC),
    ('محمد المحامي', 975.00::NUMERIC),
    ('الزناتي', 2332.00::NUMERIC),
    ('الحاج أحمد', 5.00::NUMERIC),
    ('تاتا', 1130.00::NUMERIC),
    ('حازم الوزير', 85.00::NUMERIC),
    ('عبد عبده', 890.00::NUMERIC),
    ('البيلي', 5.00::NUMERIC),
    ('كريم البياع', 100.00::NUMERIC),
    ('حسام سالم', 75.00::NUMERIC),
    ('إسلام عبوده', 290.00::NUMERIC),
    ('عطية', 770.00::NUMERIC),
    ('الحجاج', 30.00::NUMERIC),
    ('عمرو', 60.00::NUMERIC),
    ('منصور شحاته', 185.00::NUMERIC),
    ('رامي بيك', 615.00::NUMERIC),
    ('بيبو', 55.00::NUMERIC),
    ('أحمد منصور', 190.00::NUMERIC)
)
INSERT INTO customers (name, phone, total_debt)
SELECT src.customer_name, NULL, src.opening_balance
FROM opening_customer_balances src
WHERE NOT EXISTS (
  SELECT 1
  FROM customers existing
  WHERE lower(trim(existing.name)) = lower(trim(src.customer_name))
);

COMMIT;

-- مراجعة العملاء والأرصدة بعد الإضافة.
WITH opening_customer_balances (customer_name) AS (
  VALUES
    ('عمرو فهاد'), ('إبراهيم أبو الخير'), ('علاء'), ('محمد المحامي'),
    ('الزناتي'), ('الحاج أحمد'), ('تاتا'), ('حازم الوزير'), ('عبد عبده'),
    ('البيلي'), ('كريم البياع'), ('حسام سالم'), ('إسلام عبوده'), ('عطية'),
    ('الحجاج'), ('عمرو'), ('منصور شحاته'), ('رامي بيك'), ('بيبو'), ('أحمد منصور')
)
SELECT c.name, c.total_debt
FROM customers c
JOIN opening_customer_balances src
  ON lower(trim(c.name)) = lower(trim(src.customer_name))
ORDER BY c.name;

-- مراجعة إجمالي أرصدة العملاء الموجودين في الكشف.
WITH opening_customer_balances (customer_name) AS (
  VALUES
    ('عمرو فهاد'), ('إبراهيم أبو الخير'), ('علاء'), ('محمد المحامي'),
    ('الزناتي'), ('الحاج أحمد'), ('تاتا'), ('حازم الوزير'), ('عبد عبده'),
    ('البيلي'), ('كريم البياع'), ('حسام سالم'), ('إسلام عبوده'), ('عطية'),
    ('الحجاج'), ('عمرو'), ('منصور شحاته'), ('رامي بيك'), ('بيبو'), ('أحمد منصور')
)
SELECT COALESCE(SUM(c.total_debt), 0)::NUMERIC(12,2) AS opening_debt_total
FROM customers c
JOIN opening_customer_balances src
  ON lower(trim(c.name)) = lower(trim(src.customer_name));

-- الناتج المتوقع: 10514.00
