-- Patch v26: سجلات تقفيل الشفتات (تقفيل كل صالة من آخر تقفيل لحد لحظة التقفيل)
-- شغّله في Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS shift_closings (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,              -- اسم الصالة أو __type__takeaway وهكذا
  bucket_label TEXT,                 -- العنوان المعروض وقت التقفيل
  from_at TIMESTAMPTZ NOT NULL,      -- بداية الفترة (آخر تقفيل)
  to_at TIMESTAMPTZ NOT NULL,        -- لحظة التقفيل
  orders_count INTEGER DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,        -- المبيعات قبل الضريبة
  tax NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  collected NUMERIC DEFAULT 0,       -- إجمالي المحصل بالضريبة
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{ method, label, amount }]
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{ name, qty, total, lines:[{name,qty,total}] }]
  order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_closings_bucket ON shift_closings (bucket, to_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_closings_to_at ON shift_closings (to_at DESC);

ALTER TABLE shift_closings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shift_closings' AND policyname = 'shift_closings_all'
  ) THEN
    CREATE POLICY shift_closings_all ON shift_closings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
