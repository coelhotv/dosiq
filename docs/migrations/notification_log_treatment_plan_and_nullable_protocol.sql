-- Migration: notification_log — suporte a notificações agrupadas por plano
--
-- Contexto (Sprint N1.8 / PR #504):
--   dose_reminder_by_plan e dose_reminder_misc não têm protocol_id individual
--   (agrupam múltiplos protocolos). A constraint NOT NULL impedia o INSERT,
--   deixando a inbox vazia mesmo com o push entregue.
--   Adicionadas colunas treatment_plan_id e treatment_plan_name para que a
--   inbox identifique e navegue para o plano de tratamento correto.

-- 1. Tornar protocol_id nullable (kinds agrupados não têm protocolo único)
ALTER TABLE public.notification_log
  ALTER COLUMN protocol_id DROP NOT NULL;

-- 2. Adicionar treatment_plan_id como FK para treatment_plans (nullable)
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS treatment_plan_id uuid NULL
    REFERENCES public.treatment_plans (id) ON DELETE SET NULL;

-- 3. Adicionar treatment_plan_name como cache desnormalizado (nullable)
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS treatment_plan_name text NULL;

-- 4. Índice para consultas de inbox por plano de tratamento
CREATE INDEX IF NOT EXISTS idx_notification_log_treatment_plan
  ON public.notification_log (user_id, treatment_plan_id)
  WHERE treatment_plan_id IS NOT NULL;
