-- ============================================================
-- 🔴🔴🔴  تصفير كامل — بداية جديدة  🔴🔴🔴
-- ============================================================
-- ⚠️  ده بيمسح كل الحركات (أوردرات + ماليات + مخزون + حضور) نهائيًا ومش بيرجع.
-- ⚠️  اعملي Backup الأول:  Supabase → Database → Backups  (أو صدّري الجداول CSV).
--
-- بيتمسح:   الأوردرات، المصروفات، التحويلات المالية، فواتير المشتريات، التقفيلات
--           (اليومي وتقفيل الشفتات)، حركات الشركاء، حركات الموظفين (سلف/خصومات)،
--           الحضور والانصراف، أوامر التصنيع، سجلات الإنتاج، طلبات التحويل،
--           حركات المخزون، الإشعارات.
-- بيتصفّر:  أرصدة المخزون → 0 ، مديونيات العملاء → 0.
--
-- بيفضل زي ما هو (متمسحش):  التصنيفات، المنتجات، منتجات البار، الإعدادات،
--           المستخدمين، الطابعات، الموردين، الشركاء (برأس مالهم)، قائمة العملاء،
--           الموظفين (بمرتباتهم)، الوصفات.
--
-- الملف بيتخطى أي جدول أو عمود مش موجود بدل ما يقف بخطأ في النص.
-- ============================================================

BEGIN;

-- 1) مسح كل الحركات (بيعدّي على الجداول الموجودة بس)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'orders',
    'expenses',
    'financial_transactions',
    'purchase_invoices',
    'daily_closings',
    'shift_closings',
    'partner_transactions',
    'employee_transactions',
    'attendance_logs',
    'manufacturing_orders',
    'production_logs',
    'transfer_requests',
    'inventory_movements',
    'system_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DELETE FROM %I', t);
      RAISE NOTICE 'اتمسح: %', t;
    ELSE
      RAISE NOTICE 'اتخطى (مش موجود): %', t;
    END IF;
  END LOOP;
END $$;

-- 2) تصفير الأرصدة (بدون مسح الصفوف)
DO $$
DECLARE
  col TEXT;
  stock_cols TEXT[] := ARRAY['stock_main', 'stock_factory', 'stock_bar', 'stock_distribution'];
BEGIN
  IF to_regclass('public.customers') IS NOT NULL THEN
    UPDATE customers SET total_debt = 0;
  END IF;

  -- أسماء أعمدة المخزون اختلفت بين النسخ (stock_bar / stock_distribution)
  -- فبنصفّر اللي موجود منها بس
  IF to_regclass('public.inventory_items') IS NOT NULL THEN
    FOREACH col IN ARRAY stock_cols LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inventory_items' AND column_name = col
      ) THEN
        EXECUTE format('UPDATE inventory_items SET %I = 0', col);
        RAISE NOTICE 'اتصفّر: inventory_items.%', col;
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- (اختياري) لو عايزة تصفّري رأس مال الشركاء كمان لـ 0، شيلي علامة التعليق:
-- UPDATE partners SET opening_balance = 0;
-- ============================================================
