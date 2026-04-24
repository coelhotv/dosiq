-- Migration: Central de Avisos v1 — adicionar campos de conteúdo e unificar canais
-- Sprint 8.4

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS title          text,
  ADD COLUMN IF NOT EXISTS body           text,
  ADD COLUMN IF NOT EXISTS medicine_name  text,
  ADD COLUMN IF NOT EXISTS protocol_name  text,
  ADD COLUMN IF NOT EXISTS channels       jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.notification_log.title         IS 'Título da notificação conforme enviado ao usuário';
COMMENT ON COLUMN public.notification_log.body          IS 'Corpo completo da mensagem enviada';
COMMENT ON COLUMN public.notification_log.medicine_name IS 'Nome do medicamento no momento do envio (desnormalizado — imutável)';
COMMENT ON COLUMN public.notification_log.protocol_name IS 'Nome do protocolo no momento do envio (desnormalizado — imutável)';
COMMENT ON COLUMN public.notification_log.channels      IS 'Array de canais utilizados e resultados: [{channel, status, message_id?}]';
