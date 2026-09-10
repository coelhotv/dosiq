-- =============================================================================
-- 20260910_notification_log_status_vocab.sql
-- Spec 082 — Slice A (PR 1) · ADR-100
--
-- Amplia o domínio de `notification_log.status` para que o valor descreva o
-- DESFECHO DA ENTREGA FÍSICA, e não uma redução binária enviada/falhou.
--
-- Valores adicionados:
--   suprimida_alarme — push omitido de propósito porque o alarme local cobre a dose
--   sem_canal        — o paciente não tem nenhum canal físico ativo; NADA foi entregue
--
-- Valores preservados (nenhuma linha histórica é reescrita — decisão D2 da spec):
--   pendente, sucesso, falha, silenciada, enviada, falhou, entregue
--
-- ⚠️ ORDEM DE DEPLOY (obrigatória): esta migração é aplicada ANTES de qualquer
--    código que escreva os valores novos. O rollback abaixo só é seguro enquanto
--    não existir linha com valor novo — a ordem de deploy é o que garante isso.
--
-- Não há CREATE TABLE nem função nova: grants, RLS e SECURITY DEFINER da tabela
-- permanecem exatamente como estão (nada a conceder aqui).
-- DDL não-destrutiva: o CHECK só é AMPLIADO, nunca apertado — o gate de frota do
-- ADR-088 (./scripts/fleet-versions.sh) não se aplica.
--
-- Constraint atual verificada em prod via pg_get_constraintdef em 2026-09-10 (R-295).
-- =============================================================================

BEGIN;

ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_status_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_status_check
  CHECK (
    status IN (
      -- históricos, preservados (D2)
      'pendente',
      'sucesso',
      'falha',
      'entregue',
      -- vocabulário do ADR-100
      'enviada',
      'falhou',
      'silenciada',
      'suprimida_alarme',
      'sem_canal'
    )
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (só antes de existir linha com valor novo)
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.notification_log
--   DROP CONSTRAINT IF EXISTS notification_log_status_check;
-- ALTER TABLE public.notification_log
--   ADD CONSTRAINT notification_log_status_check
--   CHECK (status IN ('pendente','sucesso','falha','silenciada','enviada','falhou','entregue'));
-- COMMIT;
