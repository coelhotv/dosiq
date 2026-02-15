-- Query to check if user has active protocols with Telegram
-- Run in Supabase SQL Editor

-- Check user's Telegram chat ID
SELECT 
  user_id,
  telegram_chat_id,
  timezone
FROM user_settings
WHERE user_id = 'b0c9746c-c4d9-4954-a198-59856009be26';

-- Check active protocols for user
SELECT 
  p.id,
  p.user_id,
  p.active,
  p.time_schedule,
  p.last_notified_at,
  p.last_soft_reminder_at,
  p.status_ultima_notificacao,
  m.name as medicine_name,
  m.dosage_unit
FROM protocols p
JOIN medicines m ON p.medicine_id = m.id
WHERE p.user_id = 'b0c9746c-c4d9-4954-a198-59856009be26'
  AND p.active = true
ORDER BY p.created_at DESC;

-- Check medicine logs for today
SELECT 
  id,
  protocol_id,
  taken_at,
  quantity_taken
FROM medicine_logs
WHERE user_id = 'b0c9746c-c4d9-4954-a198-59856009be26'
  AND taken_at >= CURRENT_DATE
ORDER BY taken_at DESC;

-- Check all users with Telegram
SELECT 
  user_id,
  telegram_chat_id,
  timezone,
  COUNT(*) OVER() as total_users_with_telegram
FROM user_settings
WHERE telegram_chat_id IS NOT NULL;
