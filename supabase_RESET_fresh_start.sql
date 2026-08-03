-- ============================================================
-- 🔴🔴🔴  تصفير كامل — بداية جديدة  🔴🔴🔴
-- ============================================================
-- ⚠️  ده بيمسح كل الحركات (أوردرات + ماليات + مخزون + حضور) نهائيًا ومش بيرجع.
-- ⚠️  اعملي Backup الأول:  Supabase → Database → Backups  (أو صدّري الجداول CSV).
--
-- بيتمسح:   الأوردرات، المصروفات، التحويلات المالية، فواتير المشتريات، التقفيلات،
--           حركات الشركاء، حركات الموظفين (سلف/خصومات)، الحضور والانصراف،
--           أوامر التصنيع، سجلات الإنتاج، طلبات التحويل، حركات المخزون، الإشعارات.
-- بيتصفّر:  أرصدة المخزون → 0 ، مديونيات العملاء → 0.
--
-- بيفضل زي ما هو (متمسحش):  التصنيفات، المنتجات، منتجات البار، الإعدادات،
--           المستخدمين، الطابعات، الموردين، الشركاء (برأس مالهم)، قائمة العملاء،
--           الموظفين (بمرتباتهم)، الوصفات.
-- ============================================================

BEGIN;

-- 1) مسح كل الحركات
DELETE FROM orders;
DELETE FROM expenses;
DELETE FROM financial_transactions;
DELETE FROM purchase_invoices;
DELETE FROM daily_closings;
DELETE FROM partner_transactions;
DELETE FROM employee_transactions;
DELETE FROM attendance_logs;
DELETE FROM manufacturing_orders;
DELETE FROM production_logs;
DELETE FROM transfer_requests;
DELETE FROM inventory_movements;
DELETE FROM system_notifications;

-- 2) تصفير الأرصدة (بدون مسح الصفوف)
UPDATE customers        SET total_debt = 0;
UPDATE inventory_items  SET stock_main = 0, stock_factory = 0, stock_bar = 0;

COMMIT;

-- ============================================================
-- (اختياري) لو عايزة تصفّري رأس مال الشركاء كمان لـ 0، شيلي علامة التعليق:
-- UPDATE partners SET opening_balance = 0;
-- ============================================================
