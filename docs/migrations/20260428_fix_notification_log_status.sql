-- Update check constraint for notification_log status to include 'silenciada'
-- Sprint: Wave N2 Notification Gate Fix

ALTER TABLE public.notification_log 
DROP CONSTRAINT IF EXISTS notification_log_status_check;

ALTER TABLE public.notification_log 
ADD CONSTRAINT notification_log_status_check 
CHECK (status IN ('pendente', 'sucesso', 'falha', 'silenciada', 'enviada', 'falhou', 'entregue'));

COMMENT ON COLUMN public.notification_log.status IS 'Status da notificação: pendente, sucesso, falha, silenciada, enviada (legado), falhou (legado), entregue (legado)';
