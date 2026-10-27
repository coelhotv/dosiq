-- Spec 109 Slice A — gate do tick do cron de notificação (ADR-115). Uma chamada por minuto responde
-- "há trabalho?" por categoria; `api/notify.ts` (TICK_GATE=on) só chama os jobs apontados.
-- O gate decide SE um job roda, nunca O QUE ele envia (INV-4): cada predicado abaixo é o ESPELHO
-- LITERAL do filtro do job — mudar um sem o outro é falso-negativo (dose perdida). Guarda
-- estrutural em api/__tests__/notifyTickGate.test.ts; paridade no QA em .test.sql.
--
--   reminders_due  ← server/bot/reminders/doseReminders.ts `_fetchDueInstancesForReminder`
--                    (pending ∧ notified_at NULL ∧ snoozed_until NULL ∧ scheduled_for ∈ minuto)
--                    ∨ (pending ∧ snoozed_until ∈ minuto). Superconjunto: não filtra modo digest (E-7).
--                    Janela de 2 MINUTOS [m0, m0+2min) de propósito (RC5 CP-12): o job recalcula o
--                    minuto DEPOIS do gate; tick perto do segundo 59 faria o gate olhar M e o job M+1
--                    — dose em M+1 pulada. Superconjunto só custa um tick; subconjunto perde dose.
--   la_start_due   ← server/notifications/apns/dispatchLiveActivityStarts.ts
--                    `_fetchPendingCriticalInstances` (pending ∧ critical ∧ la_push_started_at NULL ∧
--                    scheduled_for ∈ [now, now+lead]).
--   la_active      ← dispatchLiveActivityLifecycle.ts (la_push_token NOT NULL ∧ scheduled_for ≥ now-24h)
--   outbox_pending ← public.claim_notification_outbox (pending ∨ processing preso > 15 min)
--   profiles       ← perfis DISTINTOS (timezone, notification_mode, digest_time) de user_settings —
--                    o TS aplica as regras de janela (server/notifications/windows.ts). Sem user_id.
--
-- R-270 — Failure Modes (analysis-A.md FM-1…13):
--   p_now NULL → COALESCE(now()). Tabelas vazias → todos false, profiles = [] (nunca NULL).
--   tz inválida/NULL → a RPC não converte fuso; o TS isola por perfil. EXISTS ⇒ sem truncamento (AP-186).
--
-- RC-SEC (spec §Ceremony: security-review):
--   S-2  SECURITY INVOKER de propósito: o único chamador é service_role (BYPASSRLS). NÃO converter em
--        DEFINER nem conceder a anon/authenticated — viraria oráculo cross-tenant de dose devida.
--   S-1  default ACL do projeto dá EXECUTE a anon/authenticated em função nova ⇒ REVOKE explícito.
--
-- Índices: nenhum índice de dose_instances começa por scheduled_for/snoozed_until (plan.md, MCP
-- 2026-10-22). Sem CONCURRENTLY (E-9): ~12k linhas, milissegundos; aplicar fora do minuto cheio.
--
-- Aplicação: dosiq-qa primeiro (CON-044) + .test.sql; prod depois. Inerte até TICK_GATE=on.

CREATE INDEX IF NOT EXISTS idx_dose_instances_pending_scheduled
  ON public.dose_instances (scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_dose_instances_snoozed
  ON public.dose_instances (snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dose_instances_la_token
  ON public.dose_instances (scheduled_for) WHERE la_push_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_tick_work(
  p_now timestamptz DEFAULT now(),
  p_la_lead_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH t AS (
    SELECT COALESCE(p_now, now()) AS now_,
           -- minuto UTC do servidor, igual a `nowISO.slice(0,16)` do job
           date_trunc('minute', COALESCE(p_now, now()) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS m0,
           COALESCE(p_la_lead_minutes, 60) AS lead
  )
  SELECT jsonb_build_object(
    'reminders_due', EXISTS (
      SELECT 1 FROM public.dose_instances d, t
       WHERE d.status = 'pending'
         AND ((d.notified_at IS NULL AND d.snoozed_until IS NULL
               AND d.scheduled_for >= t.m0 AND d.scheduled_for < t.m0 + interval '2 minutes')
           OR (d.snoozed_until IS NOT NULL
               AND d.snoozed_until >= t.m0 AND d.snoozed_until < t.m0 + interval '2 minutes'))),
    'la_start_due', EXISTS (
      SELECT 1 FROM public.dose_instances d, t
       WHERE d.status = 'pending' AND d.critical_alarm = true AND d.la_push_started_at IS NULL
         AND d.scheduled_for >= t.now_ AND d.scheduled_for <= t.now_ + make_interval(mins => t.lead)),
    'la_active', EXISTS (
      SELECT 1 FROM public.dose_instances d, t
       WHERE d.la_push_token IS NOT NULL AND d.scheduled_for >= t.now_ - interval '24 hours'),
    'outbox_pending', EXISTS (
      SELECT 1 FROM public.notification_outbox o, t
       WHERE o.status = 'pending'
          OR (o.status = 'processing' AND o.claimed_at < t.now_ - interval '15 minutes')),
    'profiles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'timezone', p.timezone, 'notification_mode', p.notification_mode,
               'digest_time', p.digest_time))
        FROM (SELECT DISTINCT s.timezone, s.notification_mode, s.digest_time::text AS digest_time
                FROM public.user_settings s) p), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.notify_tick_work(timestamptz, integer) IS
  'Spec 109/ADR-115: gate do tick. SECURITY INVOKER + só service_role (RC-SEC S-1/S-2) — não converter em DEFINER nem conceder a clientes.';

REVOKE EXECUTE ON FUNCTION public.notify_tick_work(timestamptz, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_tick_work(timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_tick_work(timestamptz, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.notify_tick_work(timestamptz, integer) TO service_role;
