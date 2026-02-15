-- Migration: Add notification status tracking to protocols
-- Phase 1 (P0): Critical status tracking
-- Created: 2026-02-15

-- Add status column to protocols table
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS status_ultima_notificacao VARCHAR(20) 
  CHECK (status_ultima_notificacao IN ('pendente', 'enviada', 'falhou', 'tentando_novamente'));

-- Add comment explaining the column
COMMENT ON COLUMN protocols.status_ultima_notificacao IS 'Status da última notificação enviada: pendente, enviada, falhou, tentando_novamente';

-- Add status column to notification_log table
ALTER TABLE notification_log 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'enviada'
  CHECK (status IN ('pendente', 'enviada', 'falhou', 'entregue'));

-- Add Telegram message ID for tracking
ALTER TABLE notification_log 
ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

-- Add error message for failed notifications
ALTER TABLE notification_log 
ADD COLUMN IF NOT EXISTS mensagem_erro TEXT;

-- Create index for faster status queries
CREATE INDEX IF NOT EXISTS idx_protocols_notification_status 
  ON protocols(status_ultima_notificacao) 
  WHERE status_ultima_notificacao IS NOT NULL;

-- Create index for notification log status
CREATE INDEX IF NOT EXISTS idx_notification_log_status 
  ON notification_log(status, sent_at);
