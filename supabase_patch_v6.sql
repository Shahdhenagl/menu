-- Patch 6: Add active status tracking to system_users
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();
