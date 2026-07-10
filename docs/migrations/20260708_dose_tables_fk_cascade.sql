-- 20260708_dose_tables_fk_cascade.sql — T000 (épico 046 LGPD Consent, hotfix independente)
-- Compliance LGPD art. 16 (eliminação após término do tratamento / exclusão de conta).
--
-- PROBLEMA (verificado em prod via MCP 2026-07-07/09):
--   3 tabelas com dado clínico do titular têm `user_id uuid NOT NULL` SEM FK para
--   auth.users, e a RPC public.delete_user_account() NÃO as deleta explicitamente:
--     - dose_instances          (parcialmente limpa via protocol_id CASCADE; órfã quando protocol_id NULL)
--     - dose_critical_events     (SEM FK alguma p/ protocols → NUNCA limpa hoje)
--     - dose_adherence_monthly   (limpa via protocol_id CASCADE; órfã se protocol_id NULL)
--   Resultado: excluir conta pode deixar dado de saúde órfão. Órfãos hoje = 0 (bug latente).
--
-- FIX: FK `ON DELETE CASCADE` de user_id → auth.users(id) nas 3 tabelas (à prova de futuro:
--   cobre a RPC delete_user_account E o prune via Supabase Admin API deleteUser do Slice B,
--   que NÃO reusa a RPC). Não basta append na RPC — repetiria o erro na próxima tabela nova.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                          |
-- |----------------------------------------|----------------------------------------------|
-- | user_id NULL                           | col é NOT NULL nas 3; FK ignora NULL de qualquer forma. N/A. |
-- | user_id órfão (sem match auth.users)   | ADD CONSTRAINT validado FALHARIA. Verificado 0 órfãos nas 3 (query pré-migração). Se surgir órfão entre check e apply → migração aborta atômica (sem estado parcial). SEGURO. |
-- | FK/constraint pré-existente homônima   | Nenhuma FK de user_id existe hoje. DROP CONSTRAINT IF EXISTS torna idempotente. |
-- | CASCADE vs append-only (dose_critical_events) | Append-only = ausência de DELETE policy no RLS. FK ON DELETE CASCADE roda a nível de sistema e BYPASSA RLS; NÃO há trigger BEFORE DELETE (verificado: zero triggers). Semanticamente correto: dado clínico do titular deve sumir (art. 16); a trilha de consentimento (consent_log, Slice A) é outra tabela e sobrevive por SET NULL. Sem conflito. |
-- | Ordem na RPC (protocols deletado antes de auth.users) | dose_instances/dose_adherence_monthly já cascateiam por protocol_id; o CASCADE por user_id em auth.users é idempotente sobre linhas já removidas. Sem conflito. |
-- | Lock                                   | ADD CONSTRAINT valida via scan (SHARE ROW EXCLUSIVE) + ACCESS EXCLUSIVE breve. Tabelas de porte moderado; janela aceitável para hotfix. |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Reversível. Aplicar via Supabase MCP (apply_migration) — testado antes com BEGIN..ROLLBACK.
-- Agente autorizado pelo PO (playbook 046 §T000).

-- 1. dose_instances
ALTER TABLE public.dose_instances
  DROP CONSTRAINT IF EXISTS dose_instances_user_id_fkey;
ALTER TABLE public.dose_instances
  ADD CONSTRAINT dose_instances_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. dose_critical_events (append-only ADR-077 — CASCADE bypassa RLS, sem trigger de bloqueio)
ALTER TABLE public.dose_critical_events
  DROP CONSTRAINT IF EXISTS dose_critical_events_user_id_fkey;
ALTER TABLE public.dose_critical_events
  ADD CONSTRAINT dose_critical_events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. dose_adherence_monthly
ALTER TABLE public.dose_adherence_monthly
  DROP CONSTRAINT IF EXISTS dose_adherence_monthly_user_id_fkey;
ALTER TABLE public.dose_adherence_monthly
  ADD CONSTRAINT dose_adherence_monthly_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Verificação pós-aplicação:
--   SELECT conname, confdeltype FROM pg_constraint
--   WHERE conname IN ('dose_instances_user_id_fkey',
--                     'dose_critical_events_user_id_fkey',
--                     'dose_adherence_monthly_user_id_fkey');
--   (confdeltype esperado = 'c' = CASCADE nas 3)
--
-- Rollback:
--   ALTER TABLE public.dose_instances        DROP CONSTRAINT IF EXISTS dose_instances_user_id_fkey;
--   ALTER TABLE public.dose_critical_events  DROP CONSTRAINT IF EXISTS dose_critical_events_user_id_fkey;
--   ALTER TABLE public.dose_adherence_monthly DROP CONSTRAINT IF EXISTS dose_adherence_monthly_user_id_fkey;
