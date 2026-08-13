-- إصلاح تقفيل الخزنة: إضافة القيد الفريد المطلوب لعملية upsert
-- شغّل هذا الملف من Supabase SQL Editor مرة واحدة.

CREATE TABLE IF NOT EXISTS public.daily_closings (
  id TEXT PRIMARY KEY,
  closing_date DATE NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  drawer_1_closed BOOLEAN NOT NULL DEFAULT false,
  drawer_2_closed BOOLEAN NOT NULL DEFAULT false,
  drawer_1_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  drawer_2_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  drawer_1_total_expected NUMERIC DEFAULT 0,
  drawer_2_total_expected NUMERIC DEFAULT 0,
  drawer_1_total_counted NUMERIC DEFAULT 0,
  drawer_2_total_counted NUMERIC DEFAULT 0
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

-- لو كان الجدول القديم يحتوي على تكرارات لنفس التاريخ، نحتفظ بآخر سجل فقط.
WITH duplicated AS (
  SELECT ctid,
         ROW_NUMBER() OVER (
           PARTITION BY closing_date
           ORDER BY COALESCE(closed_at, created_at) DESC NULLS LAST, id DESC
         ) AS row_number
  FROM public.daily_closings
)
DELETE FROM public.daily_closings d
USING duplicated x
WHERE d.ctid = x.ctid
  AND x.row_number > 1;

-- هذا القيد هو المطلوب تحديدًا لـ:
-- upsert(..., { onConflict: 'closing_date' })
CREATE UNIQUE INDEX IF NOT EXISTS daily_closings_closing_date_unique
  ON public.daily_closings (closing_date);

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

-- تحقق بعد التنفيذ
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'daily_closings';

SELECT
  id,
  closing_date,
  drawer_1_closed,
  drawer_2_closed,
  closed_at
FROM public.daily_closings
ORDER BY closing_date DESC
LIMIT 20;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- بعد تشغيل الملف اعمل Hard Reload للموقع ثم جرّب التقفيل.
