-- Patch 5: Add Telegram Bot credentials to restaurant_settings

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT;
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
