-- 1. Alterar o default da coluna notification_preference para NULL para novos usuários
ALTER TABLE user_settings 
  ALTER COLUMN notification_preference DROP DEFAULT;

-- 2. Limpar preferências inconsistentes de Telegram para usuários existentes
UPDATE user_settings
SET 
  channel_telegram_enabled = false,
  notification_preference = CASE 
    WHEN channel_mobile_push_enabled THEN 'mobile_push'::text
    ELSE 'none'::text
  END
WHERE telegram_chat_id IS NULL 
  AND (channel_telegram_enabled = true OR notification_preference IN ('telegram', 'both'));
