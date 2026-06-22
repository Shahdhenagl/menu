-- Patch 3: Add departments (restaurant/bar) to categories and printers

ALTER TABLE categories ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'restaurant';
ALTER TABLE printers ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'restaurant';
