-- Create notification_devices table to store push notification device tokens
-- Supports multi-device per user (mobile app can be installed on multiple phones)
-- Tracks Expo push tokens, device info, and activation status
-- RLS policies ensure users can only access their own devices

CREATE TABLE IF NOT EXISTS notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_kind text NOT NULL CHECK (app_kind IN ('native', 'pwa')),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  provider text NOT NULL CHECK (provider IN ('expo', 'webpush')),
  push_token text NOT NULL,
  device_name text,
  device_fingerprint text,
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, push_token)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_user_id
  ON notification_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_devices_active_provider
  ON notification_devices (is_active, provider);

ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notification devices"
  ON notification_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification devices"
  ON notification_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification devices"
  ON notification_devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
