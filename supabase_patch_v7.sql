-- Patch 7: Employee Management and Attendance System Tables

-- 1. Create Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  salary NUMERIC NOT NULL,
  allowed_vacations INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for everyone" ON employees;
CREATE POLICY "Allow all for everyone" ON employees FOR ALL USING (true) WITH CHECK (true);

-- 2. Create Attendance Logs Table
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL,
  check_out_time TIMESTAMPTZ,
  check_in_photo TEXT, -- رابط أو Base64
  check_out_photo TEXT, -- رابط أو Base64
  working_hours NUMERIC,
  penalty_applied NUMERIC DEFAULT 0,
  date DATE NOT NULL, -- YYYY-MM-DD
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for attendance_logs
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for everyone" ON attendance_logs;
CREATE POLICY "Allow all for everyone" ON attendance_logs FOR ALL USING (true) WITH CHECK (true);

-- 3. Create Employee Transactions Table (Advances, Bonuses, Discounts, Vacations)
CREATE TABLE IF NOT EXISTS employee_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'advance', 'bonus', 'discount', 'vacation_paid', 'vacation_unpaid'
  amount NUMERIC DEFAULT 0,
  date DATE NOT NULL, -- YYYY-MM-DD
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for employee_transactions
ALTER TABLE employee_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for everyone" ON employee_transactions;
CREATE POLICY "Allow all for everyone" ON employee_transactions FOR ALL USING (true) WITH CHECK (true);
