-- Patch 8: Add working_hours to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS working_hours NUMERIC DEFAULT 9;
