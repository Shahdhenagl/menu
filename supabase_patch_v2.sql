-- Patch 2: Add Customers, Debts, and Low Stock Notifications

-- 1. Create Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  total_debt NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for everyone" ON customers;
CREATE POLICY "Allow all for everyone" ON customers FOR ALL USING (true) WITH CHECK (true);

-- 2. Add columns to Orders table for Deferred Payment and Profit tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

-- 3. Add column to Restaurant Settings for location URL
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS location_url TEXT;

-- 4. Add low stock threshold to Inventory Items
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC DEFAULT 5000;
