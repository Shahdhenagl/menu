-- Patch v37: harden shift closing schema, access, and cash movement columns.
-- Run once in Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS shift_closings (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  bucket_label TEXT,
  from_at TIMESTAMPTZ NOT NULL,
  to_at TIMESTAMPTZ NOT NULL,
  orders_count INTEGER DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  collected NUMERIC DEFAULT 0,
  deposits NUMERIC NOT NULL DEFAULT 0,
  expenses NUMERIC NOT NULL DEFAULT 0,
  expected_balance NUMERIC NOT NULL DEFAULT 0,
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  deposits_by_method JSONB NOT NULL DEFAULT '[]'::jsonb,
  expenses_by_method JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS bucket_label TEXT;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS from_at TIMESTAMPTZ;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS to_at TIMESTAMPTZ;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS orders_count INTEGER DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS collected NUMERIC DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS deposits NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS expenses NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS expected_balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS methods JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS deposits_by_method JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS expenses_by_method JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS order_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS tax_groups JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS categories JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS order_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS closed_by TEXT;
ALTER TABLE shift_closings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_shift_closings_bucket_to_at ON shift_closings (bucket, to_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_closings_to_at ON shift_closings (to_at DESC);

ALTER TABLE shift_closings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shift_closings_all ON shift_closings;
CREATE POLICY shift_closings_all ON shift_closings FOR ALL USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE shift_closings TO anon, authenticated;

COMMIT;
