-- 20261102_device_capability_event.test.sql — validação BEGIN..ROLLBACK (R-270 / PO-D2-5)
--
-- Cada bloco é autossuficiente (o MCP não mantém sessão entre chamadas). Rodar no QA antes do
-- apply_migration; repetir em prod antes do apply de prod (T100).
--
-- RESULTADO REGISTRADO — QA (ikcvwxyohmntncanclze), 2026-11-02: 3/3 conforme esperado.
--   Bloco 1: id 8e543eed…, event device_capability, dose_instance_id NULL, capable 'false'   ✅
--   Bloco 2: ERROR 23514 dose_critical_events_event_check ('Device_Capability')              ✅
--   Bloco 3: antes 4.830 linhas · 13 tipos; depois do apply 4.830 linhas; CHECK com 14 valores ✅
--   Prod: pendente (T100, após o merge do PR 6a).

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 1 — o valor novo é ACEITO, com dose_instance_id NULL e `detail` da allowlist
--   esperado: 1 linha, sem 23514
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events DROP CONSTRAINT dose_critical_events_event_check;
ALTER TABLE public.dose_critical_events ADD CONSTRAINT dose_critical_events_event_check
  CHECK (event = ANY (ARRAY['alarm_scheduled'::text,'alarm_fired'::text,'alarm_suppressed'::text,
    'nag_fired'::text,'snoozed'::text,'resolved'::text,'push_sent'::text,'push_failed'::text,
    'surface_transitioned'::text,'push_skipped_no_token'::text,'token_captured'::text,
    'titration_transitioned'::text,'alarm_out_of_window'::text,'device_capability'::text]));

INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor, detail)
SELECT u.id, NULL, 'device_capability', 'android', 'system',
       '{"capable":false,"notifications_allowed":true,"alarm_channel_blocked":true,"exact_alarm_allowed":true,"critical_expected":2,"critical_armed":0,"app_version":"0.34.2"}'::jsonb
  FROM auth.users u LIMIT 1
RETURNING id, event, dose_instance_id, detail->>'capable' AS capable;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 2 — GUARD: o CHECK é sensível a CAIXA (R-271 verbatim)
--   esperado: ERROR 23514 dose_critical_events_event_check
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events DROP CONSTRAINT dose_critical_events_event_check;
ALTER TABLE public.dose_critical_events ADD CONSTRAINT dose_critical_events_event_check
  CHECK (event = ANY (ARRAY['alarm_scheduled'::text,'alarm_fired'::text,'alarm_suppressed'::text,
    'nag_fired'::text,'snoozed'::text,'resolved'::text,'push_sent'::text,'push_failed'::text,
    'surface_transitioned'::text,'push_skipped_no_token'::text,'token_captured'::text,
    'titration_transitioned'::text,'alarm_out_of_window'::text,'device_capability'::text]));

INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor)
SELECT u.id, NULL, 'Device_Capability', 'android', 'system' FROM auth.users u LIMIT 1;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 3 — GUARD: nenhum evento existente é perdido (medir antes e depois do apply real)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT event, count(*) AS n FROM public.dose_critical_events GROUP BY 1 ORDER BY 1;
