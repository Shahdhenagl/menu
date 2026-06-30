-- ============================================================================
-- Patch v20: محفظة البار (bar_wallet) كوسيلة تحصيل + مصروف من عُهدة شريك
-- - يضيف عمود partner_id لجدول expenses (للمصروف المخصوم من عُهدة شريك)
-- - يضمن إن أعمدة payment_method تقبل القيم الجديدة 'bar_wallet' و 'partner'
--   (لو فيه CHECK constraints قديمة بتحصرها في قيم معينة، بنشيلها)
-- آمن لإعادة التشغيل.
-- ============================================================================

BEGIN;

-- (1) عمود الشريك في المصروفات
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id);

-- (2) شيل أي CHECK constraint على expenses.payment_method (لو موجود) عشان نسمح بالقيم الجديدة
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'expenses' AND ns.nspname = 'public' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%payment_method%'
  LOOP
    EXECUTE format('ALTER TABLE expenses DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- (3) شيل أي CHECK constraint على orders.payment_method (لو موجود) عشان نسمح بـ 'bar_wallet'
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'orders' AND ns.nspname = 'public' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%payment_method%'
  LOOP
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- (4) شيل أي CHECK constraint على financial_transactions.(from_method/to_method)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'financial_transactions' AND ns.nspname = 'public' AND con.contype = 'c'
      AND (pg_get_constraintdef(con.oid) ILIKE '%from_method%' OR pg_get_constraintdef(con.oid) ILIKE '%to_method%')
  LOOP
    EXECUTE format('ALTER TABLE financial_transactions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

COMMIT;

-- تحقّق سريع: اتأكد إن العمود اتضاف
-- SELECT column_name FROM information_schema.columns WHERE table_name='expenses' AND column_name='partner_id';
