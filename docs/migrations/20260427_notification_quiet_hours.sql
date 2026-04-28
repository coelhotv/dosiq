-- Wave N2: Quiet Hours + canais explícitos + modo de notificação
-- Adiciona campos a user_settings para controle granular de quando/onde notificar

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end   TIME,
  ADD COLUMN IF NOT EXISTS notification_mode TEXT DEFAULT 'realtime',
  ADD COLUMN IF NOT EXISTS digest_time       TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS channel_mobile_push_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS channel_web_push_enabled    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS channel_telegram_enabled    BOOLEAN;

-- CHECK constraint para notification_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_settings_notification_mode_check'
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT user_settings_notification_mode_check
      CHECK (notification_mode IN ('realtime', 'digest_morning', 'silent'));
  END IF;
END $$;

-- Backfill: derivar booleans de canal a partir do campo legado notification_preference
UPDATE user_settings
SET
  channel_mobile_push_enabled = notification_preference IN ('mobile_push', 'both'),
  channel_telegram_enabled    = notification_preference IN ('telegram', 'both'),
  channel_web_push_enabled    = COALESCE(channel_web_push_enabled, false)
WHERE channel_mobile_push_enabled IS NULL
   OR channel_telegram_enabled IS NULL;

-- Tornar booleans de canal NOT NULL com defaults após backfill
ALTER TABLE user_settings
  ALTER COLUMN channel_mobile_push_enabled SET DEFAULT true,
  ALTER COLUMN channel_mobile_push_enabled SET NOT NULL,
  ALTER COLUMN channel_web_push_enabled    SET DEFAULT false,
  ALTER COLUMN channel_web_push_enabled    SET NOT NULL,
  ALTER COLUMN channel_telegram_enabled    SET DEFAULT false,
  ALTER COLUMN channel_telegram_enabled    SET NOT NULL;
