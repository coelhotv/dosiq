-- =============================================================================
-- 20260911_notification_log_suprimida_sem_prova.sql
-- Spec 082 — Slice C (PR 3) · ADR-100 (emendado) · FR-012b
--
-- Acrescenta o 6º valor do vocabulário do ADR-100:
--   suprimida_sem_prova — push omitido porque NÃO há prova de alarme para aquela
--                         dose E o usuário não é capaz de produzir essa prova
--                         (frota anterior à trilha `alarm_scheduled`). A dose NÃO
--                         foi avisada por ninguém: é o silêncio residual do D1.
--
-- Por que não reusar `suprimida_alarme`: os dois casos são OPOSTOS em risco. Com
-- prova, a dose está COBERTA pelo alarme do aparelho (risco zero) — e a apuração
-- do Slice B classifica `suprimida_alarme` como `coberta`, que não alerta. Sem
-- prova, ninguém avisou a paciente. Colapsar os dois faz a dose não-avisada sair
-- do relatório diário com carimbo de cobertura — a família exata do defeito que
-- abriu esta spec — e torna o SC-002a inobtenível.
--
-- Valores preservados: os 9 atuais (nenhuma linha histórica é reescrita — D2).
--
-- ⚠️ ORDEM DE DEPLOY (obrigatória): aplicada ANTES de qualquer código que escreva
--    o valor novo. O rollback abaixo só é seguro enquanto não existir linha com
--    `suprimida_sem_prova` — a ordem de deploy é o que garante isso.
--
-- Sem CREATE TABLE e sem função nova: grants, RLS e SECURITY DEFINER da tabela
-- permanecem como estão (nada a conceder aqui).
-- DDL não-destrutiva: o CHECK só é AMPLIADO, nunca apertado — o gate de frota do
-- ADR-088 (./scripts/fleet-versions.sh) não se aplica.
--
-- Constraint atual verificada em prod via pg_get_constraintdef em 2026-09-11 (R-295):
--   9 valores, nenhum para "suprimida sem prova".
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
      'sem_canal',
      -- ADR-100 emendado no Slice C (FR-012b)
      'suprimida_sem_prova'
    )
  );

COMMIT;

-- =============================================================================
-- ROLLBACK (só antes de existir linha com `suprimida_sem_prova`)
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.notification_log
--   DROP CONSTRAINT IF EXISTS notification_log_status_check;
-- ALTER TABLE public.notification_log
--   ADD CONSTRAINT notification_log_status_check
--   CHECK (status IN ('pendente','sucesso','falha','entregue','enviada','falhou',
--                     'silenciada','suprimida_alarme','sem_canal'));
-- COMMIT;
