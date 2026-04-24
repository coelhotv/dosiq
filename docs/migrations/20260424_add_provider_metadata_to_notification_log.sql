-- Migration: Adicionar provider_metadata à tabela notification_log (Sprint 8.1)
-- Permite armazenar IDs de mensagem do Telegram e tickets de recibo do Expo Push.

ALTER TABLE public.notification_log
ADD COLUMN IF NOT EXISTS provider_metadata jsonb DEFAULT '{}'::jsonb;

-- Comentário para documentar o uso da coluna
COMMENT ON COLUMN public.notification_log.provider_metadata IS 'Metadados específicos do provedor (telegram_message_id, expo_receipt_ticket, etc)';
