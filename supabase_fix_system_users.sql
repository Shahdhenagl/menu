-- 🟢 يضمن وجود كل أعمدة جدول مستخدمي النظام (شغّله مرة واحدة في Supabase SQL Editor)
-- آمن للتشغيل أكتر من مرة — IF NOT EXISTS

ALTER TABLE system_users ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS phone          TEXT;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS username       TEXT;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS passcode       TEXT;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS role           TEXT;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS job_title      TEXT;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS is_active      BOOLEAN DEFAULT true;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE system_users ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT now();
