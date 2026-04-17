-- Add notification_preference column to user_settings
-- Stores user's preference for notification delivery channels
-- Options: 'telegram', 'mobile_push', 'both', 'none'
-- Default: 'telegram' (legacy behavior for existing users)

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS notification_preference text DEFAULT 'telegram';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_settings_notification_preference_check'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_notification_preference_check
    CHECK (notification_preference IN ('telegram', 'mobile_push', 'both', 'none'));
  END IF;
END $$;
