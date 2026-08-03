-- 🟢 إنشاء حساب موظف لكل كابتن (waiter) عشان يقدر ياخد حضور وانصراف
-- شغّله مرة واحدة في Supabase SQL Editor — آمن للتكرار (مش بيعمل تكرار بالاسم)
-- الراتب 0 وساعات العمل 9 افتراضيًا، تقدري تعدّليهم بعدين من تبويب "الموظفين".

INSERT INTO employees (id, name, phone, salary, allowed_vacations, working_hours, created_at)
SELECT gen_random_uuid(),
       su.name,
       COALESCE(su.phone, ''),
       0,          -- الراتب (عدّليه بعدين)
       4,          -- الإجازات المسموحة
       9,          -- ساعات العمل
       NOW()
FROM system_users su
WHERE su.role = 'waiter'
  AND su.name IS NOT NULL
  AND btrim(su.name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE lower(btrim(e.name)) = lower(btrim(su.name))
  );
