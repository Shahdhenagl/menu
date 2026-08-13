-- Patch v34: operating day and independent drawer closing
-- Run this migration in Supabase SQL Editor.
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_1_closed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_2_closed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_1_methods JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_2_methods JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_1_total_expected NUMERIC DEFAULT 0;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_2_total_expected NUMERIC DEFAULT 0;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_1_total_counted NUMERIC DEFAULT 0;
ALTER TABLE daily_closings ADD COLUMN IF NOT EXISTS drawer_2_total_counted NUMERIC DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS drawer SMALLINT CHECK (drawer IN (1, 2));
CREATE INDEX IF NOT EXISTS idx_orders_operating_day ON orders (created_at, status, table_number);
CREATE INDEX IF NOT EXISTS idx_expenses_operating_day ON expenses (expense_date, drawer);

-- Prevent two open attendance logs for the same employee on the same day.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_one_open_log_per_employee_day
  ON attendance_logs (employee_id, date)
  WHERE check_out_time IS NULL;

CREATE TABLE IF NOT EXISTS operating_day_state (
  id TEXT PRIMARY KEY,
  operating_date DATE NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE operating_day_state ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operating_day_state' AND policyname = 'operating_day_state_all') THEN
    CREATE POLICY operating_day_state_all ON operating_day_state FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Existing legacy daily closings remain readable as drawer 1 records.
UPDATE daily_closings
SET drawer_1_closed = (status = 'closed'),
    drawer_1_methods = CASE WHEN drawer_1_methods = '[]'::jsonb THEN methods ELSE drawer_1_methods END,
    drawer_1_total_expected = COALESCE(NULLIF(drawer_1_total_expected, 0), total_expected),
    drawer_1_total_counted = COALESCE(NULLIF(drawer_1_total_counted, 0), total_counted)
WHERE drawer_1_closed = false AND drawer_2_closed = false AND status = 'closed';
