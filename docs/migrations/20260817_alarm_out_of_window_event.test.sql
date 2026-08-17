-- 20260817_alarm_out_of_window_event.test.sql — validação BEGIN..ROLLBACK (R-270 / PO-4 / PO-SEC-3)
--
-- Executado contra prod ANTES do apply_migration (2026-08-17). Cada bloco é autossuficiente
-- (o MCP não mantém sessão entre chamadas).
--
-- RESULTADO REGISTRADO: 3/3 blocos conforme esperado. Evidência colada no C4 do PR do A2.

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 1 — o valor novo é ACEITO com o `detail` de allowlist (FR-036)
--   esperado: 1 linha, sem 23514
--   obtido:   id 3540e607…, event 'alarm_out_of_window',
--             detail {delta_seconds:-13020, direction:early, manufacturer:Xiaomi,
--                     model:"Poco X6 Pro", os_version:"14"}   ✅
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events DROP CONSTRAINT dose_critical_events_event_check;
ALTER TABLE public.dose_critical_events ADD CONSTRAINT dose_critical_events_event_check
  CHECK (event = ANY (ARRAY['alarm_scheduled'::text,'alarm_fired'::text,'alarm_suppressed'::text,
    'nag_fired'::text,'snoozed'::text,'resolved'::text,'push_sent'::text,'push_failed'::text,
    'surface_transitioned'::text,'push_skipped_no_token'::text,'token_captured'::text,
    'titration_transitioned'::text,'alarm_out_of_window'::text]));

INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor, detail)
SELECT di.user_id, di.id, 'alarm_out_of_window', 'android', 'system',
       '{"delta_seconds":-13020,"direction":"early","manufacturer":"Xiaomi","model":"Poco X6 Pro","os_version":"14"}'::jsonb
  FROM public.dose_instances di LIMIT 1
RETURNING id, event, detail;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 2 — GUARD do PO-4: o CHECK NÃO foi afrouxado, e é sensível a CAIXA
--   Caixa divergente do literal do core (`Alarm_Out_Of_Window`) tem que falhar. Este é o bloco
--   que prova que enum do Zod e CHECK precisam ser verbatim (R-271) — não "equivalentes".
--   esperado: ERROR 23514
--   obtido:   ERROR 23514 dose_critical_events_event_check   ✅
-- ═════════════════════════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE public.dose_critical_events DROP CONSTRAINT dose_critical_events_event_check;
ALTER TABLE public.dose_critical_events ADD CONSTRAINT dose_critical_events_event_check
  CHECK (event = ANY (ARRAY['alarm_scheduled'::text,'alarm_fired'::text,'alarm_suppressed'::text,
    'nag_fired'::text,'snoozed'::text,'resolved'::text,'push_sent'::text,'push_failed'::text,
    'surface_transitioned'::text,'push_skipped_no_token'::text,'token_captured'::text,
    'titration_transitioned'::text,'alarm_out_of_window'::text]));

INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor)
SELECT di.user_id, di.id, 'Alarm_Out_Of_Window', 'android', 'system'
  FROM public.dose_instances di LIMIT 1;

ROLLBACK;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 3 — GUARD: nenhum evento existente é perdido pela troca do CHECK
--   Medido FORA da transação, antes e depois do apply real:
--     antes  : 11.532 linhas · 11 tipos distintos
--              (push_skipped_no_token 9274 · resolved 688 · alarm_scheduled 574 · push_failed 387
--               push_sent 160 · token_captured 160 · alarm_fired 140 · snoozed 83
--               surface_transitioned 47 · titration_transitioned 14 · alarm_suppressed 5)
--     depois : 11.532 linhas · 11 tipos distintos   ✅ (o 13º valor existe no CHECK, sem linha ainda)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT event, count(*) AS n FROM public.dose_critical_events GROUP BY 1 ORDER BY 1;

-- ═════════════════════════════════════════════════════════════════════════════
-- Bloco 4 — PO-SEC-3: grants antes/depois do REVOKE
--   antes  : anon → SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER  ⚠️
--            authenticated → SELECT, INSERT
--   depois : anon → (nenhuma linha)                                                ✅
--            authenticated → SELECT, INSERT · service_role → inalterado
--   Guard pendente do C4: INSERT REAL do app (como authenticated) após o revoke — fica na
--   T025/T028, com a linha colada.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT grantee, privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name='dose_critical_events'
   AND grantee IN ('anon','authenticated','service_role') ORDER BY 1,2;
