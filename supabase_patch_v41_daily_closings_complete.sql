-- تجهيز كامل وآمن لتقفيل اليوم والخزنتين
-- شغّل هذا الملف من Supabase SQL Editor مرة واحدة.

CREATE TABLE IF NOT EXISTS public.daily_closings (
  id TEXT PRIMARY KEY,
  closing_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'closed',
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_expected NUMERIC DEFAULT 0,
  total_counted NUMERIC DEFAULT 0,
  total_difference NUMERIC DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  expenses_count INTEGER DEFAULT 0,
  notes TEXT,
  closed_by TEXT,
  closed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.daily_closings
  ADD COLUMN IF NOT EXISTS drawer_1_closed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drawer_2_closed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS drawer_1_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS drawer_2_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS drawer_1_total_expected NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drawer_2_total_expected NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drawer_1_total_counted NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drawer_2_total_counted NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_daily_closings_date
  ON public.daily_closings (closing_date DESC);

ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_closings_all ON public.daily_closings;
CREATE POLICY daily_closings_all
  ON public.daily_closings
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_closings TO anon, authenticated;

-- التحقق من اكتمال المخطط:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'daily_closings'
ORDER BY ordinal_position;
