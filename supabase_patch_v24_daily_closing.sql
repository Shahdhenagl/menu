-- Patch v24: موديول التقفيل اليومي (تقفيل كل وسيلة دفع على حدة)
-- شغّله في Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS daily_closings (
  id TEXT PRIMARY KEY,
  closing_date DATE NOT NULL UNIQUE,     -- يوم التقفيل (YYYY-MM-DD)
  status TEXT NOT NULL DEFAULT 'closed', -- closed | reopened
  -- تفاصيل كل وسيلة: [{ method, expected, counted, difference, note }]
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_expected NUMERIC DEFAULT 0,      -- إجمالي المفروض (وارد - صادر)
  total_counted NUMERIC DEFAULT 0,       -- إجمالي المعدود فعليًا
  total_difference NUMERIC DEFAULT 0,    -- الفرق (زيادة موجب / عجز سالب)
  orders_count INTEGER DEFAULT 0,
  expenses_count INTEGER DEFAULT 0,
  notes TEXT,
  closed_by TEXT,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON daily_closings (closing_date DESC);

ALTER TABLE daily_closings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'daily_closings' AND policyname = 'daily_closings_all'
  ) THEN
    CREATE POLICY daily_closings_all ON daily_closings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
