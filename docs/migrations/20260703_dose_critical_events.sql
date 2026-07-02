-- Spec 042 (Slice A) — Audit trail de dose crítica (debug-first). ADR-077.
-- Tabela append-only reutilizável (épico 009 futuro). Aditiva, reversível.
-- Dado sensível/saúde (LGPD): RLS por user_id é o controle-mor; detail sem PII/label/token.

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.dose_critical_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  dose_instance_id uuid,  -- nullable: eventos sem ocorrência (ex.: token_captured antes de vincular)
  event            text NOT NULL,
  platform         text NOT NULL,
  actor            text NOT NULL,
  detail           jsonb,  -- só IDs+estado+snapshots não-PII (FR-007): sem nome de medicamento, sem token/segredo
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 2. CHECKs (domínio finito → CHECK, espelhado no Zod — R-270)
ALTER TABLE public.dose_critical_events
  ADD CONSTRAINT dose_critical_events_event_check CHECK (event IN (
    'alarm_scheduled','alarm_fired','alarm_suppressed','nag_fired','snoozed',
    'resolved','push_sent','push_failed','surface_transitioned',
    'push_skipped_no_token','token_captured'
  )),
  ADD CONSTRAINT dose_critical_events_platform_check CHECK (platform IN ('ios','android','server')),
  ADD CONSTRAINT dose_critical_events_actor_check CHECK (actor IN ('user','system','server'));

-- 3. Índices — trajetória por dose (SC-001) + prune/consulta por usuário
CREATE INDEX IF NOT EXISTS idx_dose_critical_events_instance ON public.dose_critical_events (dose_instance_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dose_critical_events_user     ON public.dose_critical_events (user_id, created_at);

-- 4. Grants least-privilege / append-only (RC-SEC SEC-4)
--    ⚠️ Tabela nova (pré-30/10/2026) herda grants DEFAULT full p/ authenticated →
--    REVOKE explícito é obrigatório p/ append-only; o GRANT sozinho não restringe.
GRANT SELECT, INSERT ON public.dose_critical_events TO authenticated;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.dose_critical_events FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.dose_critical_events TO service_role;  -- DELETE só p/ prune (cron)

-- 5. RLS (SEC-1) — cada usuário só lê/insere os próprios eventos
ALTER TABLE public.dose_critical_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY dose_critical_events_select_own ON public.dose_critical_events
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY dose_critical_events_insert_own ON public.dose_critical_events
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
-- Sem policy de UPDATE/DELETE p/ authenticated (append-only). service_role bypassa RLS (prune server-side).

-- 6. Prune 90d via pg_cron — POR ÚLTIMO (falha do cron não pode derrubar a tabela/trail).
--    Job roda no db postgres como service; DELETE schema-qualificado.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'prune-dose-critical-events',
  '0 3 * * *',
  $$ DELETE FROM public.dose_critical_events WHERE created_at < now() - interval '90 days' $$
);

-- Rollback:
--   SELECT cron.unschedule('prune-dose-critical-events');
--   DROP TABLE public.dose_critical_events;
