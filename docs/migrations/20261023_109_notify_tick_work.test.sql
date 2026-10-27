-- Spec 109 Slice A — prova da migração 20261023_109_notify_tick_work.sql (T003: PO-2 SQL, PO-SEC-1).
-- Roda DEPOIS do corpo da migração (sem BEGIN/COMMIT), no MESMO script, e termina com
-- RAISE EXCEPTION 'RESULT …' — o erro final desfaz tudo. Asserção que falha levanta antes.
-- A paridade RPC × fetch REAL do job (supabase-js) é o script scripts/qa/109-tick-gate-parity.ts.

-- ─── 1. Segurança (PO-SEC-1 d) ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_def boolean; v_cfg text[];
BEGIN
  SELECT p.prosecdef, p.proconfig INTO v_def, v_cfg FROM pg_proc p
   WHERE p.oid = 'public.notify_tick_work(timestamptz,integer)'::regprocedure;
  IF v_def THEN RAISE EXCEPTION 'PO-SEC-1: função virou SECURITY DEFINER'; END IF;
  IF NOT ('search_path=""' = ANY (v_cfg)) THEN RAISE EXCEPTION 'PO-SEC-1: search_path não fixado (%)', v_cfg; END IF;
  IF has_function_privilege('anon', 'public.notify_tick_work(timestamptz,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PO-SEC-1: anon executa'; END IF;
  IF has_function_privilege('authenticated', 'public.notify_tick_work(timestamptz,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PO-SEC-1: authenticated executa'; END IF;
  IF NOT has_function_privilege('service_role', 'public.notify_tick_work(timestamptz,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PO-SEC-1: service_role sem EXECUTE'; END IF;
END $$;

-- ─── 2. Instante fixo bem longe de qualquer dado real (2099) — ausência ⇒ false ────────────
DO $$
DECLARE r jsonb;
BEGIN
  r := public.notify_tick_work('2099-01-01 12:00:30+00', 60);
  IF (r->>'reminders_due')::boolean OR (r->>'la_start_due')::boolean OR (r->>'la_active')::boolean THEN
    RAISE EXCEPTION 'FM-4: esperava false sem dado em 2099, veio %', r; END IF;
  IF jsonb_typeof(r->'profiles') <> 'array' THEN RAISE EXCEPTION 'FM-4: profiles não é array'; END IF;
  -- FM-1: NULL explícito vira now()
  r := public.notify_tick_work(NULL, NULL);
  IF r IS NULL OR NOT (r ? 'outbox_pending') THEN RAISE EXCEPTION 'FM-1: NULL quebrou a RPC'; END IF;
END $$;

-- ─── 3. Semente: titular + protocolo + medicamento de teste ────────────────────────────────
INSERT INTO auth.users (id, email, created_at) VALUES
  ('10900000-0000-0000-0000-00000000000a', 't109-a@dosiq.test', now());
INSERT INTO public.medicines (id, user_id, name, dosage_per_pill, dosage_unit)
  VALUES ('10900000-0000-0000-0000-0000000000a1', '10900000-0000-0000-0000-00000000000a', 'T109', 10, 'mg');
INSERT INTO public.protocols (id, user_id, medicine_id, name, frequency, time_schedule, dosage_per_intake, start_date, active)
  VALUES ('10900000-0000-0000-0000-0000000000b1', '10900000-0000-0000-0000-00000000000a',
          '10900000-0000-0000-0000-0000000000a1', 'T109', 'diário', '["12:00"]'::jsonb, 1, '2099-01-01', true);

-- (a) devida no minuto 12:00 (positivo reminders) · (b) devida 12:02 (negativo p/ 12:00:30; positivo
--     p/ 12:01:30 — janela de 2 min, CP-12)
-- (c) soneca vencendo em 12:00 com notified_at preenchido (FM-7 positivo)
-- (d) crítica 12:40 sem start (positivo LA start c/ lead 60; negativo c/ lead 30)
-- (e) LA ativa: token, scheduled_for 2099-01-01 00:00 (≥ now-24h)
INSERT INTO public.dose_instances (user_id, protocol_id, medicine_id, scheduled_for, status, notified_at,
                                   snoozed_until, critical_alarm, la_push_token, expected_dose)
VALUES
  ('10900000-0000-0000-0000-00000000000a','10900000-0000-0000-0000-0000000000b1','10900000-0000-0000-0000-0000000000a1',
   '2099-03-01 12:00:00+00','pending',NULL,NULL,false,NULL,1),
  ('10900000-0000-0000-0000-00000000000a','10900000-0000-0000-0000-0000000000b1','10900000-0000-0000-0000-0000000000a1',
   '2099-03-02 12:02:00+00','pending',NULL,NULL,false,NULL,1),
  ('10900000-0000-0000-0000-00000000000a','10900000-0000-0000-0000-0000000000b1','10900000-0000-0000-0000-0000000000a1',
   '2099-03-03 11:30:00+00','pending','2099-03-03 11:30:00+00','2099-03-03 12:00:10+00',false,NULL,1),
  ('10900000-0000-0000-0000-00000000000a','10900000-0000-0000-0000-0000000000b1','10900000-0000-0000-0000-0000000000a1',
   '2099-03-04 12:40:00+00','pending',NULL,NULL,true,NULL,1),
  ('10900000-0000-0000-0000-00000000000a','10900000-0000-0000-0000-0000000000b1','10900000-0000-0000-0000-0000000000a1',
   '2099-03-05 00:00:00+00','taken',NULL,NULL,false,'tok-t109',1);

DO $$
DECLARE r jsonb;
BEGIN
  -- reminders: positivo (a) e negativo (b)
  IF NOT (public.notify_tick_work('2099-03-01 12:00:30+00', 0)->>'reminders_due')::boolean THEN
    RAISE EXCEPTION 'PO-2 reminders (+): dose em 12:00 não detectada'; END IF;
  IF (public.notify_tick_work('2099-03-02 12:00:30+00', 0)->>'reminders_due')::boolean THEN
    RAISE EXCEPTION 'PO-2 reminders (−): dose de 12:02 detectada em 12:00'; END IF;
  -- CP-12: o minuto seguinte também conta (o job pode recalcular o minuto depois do gate)
  IF NOT (public.notify_tick_work('2099-03-02 12:01:30+00', 0)->>'reminders_due')::boolean THEN
    RAISE EXCEPTION 'CP-12: dose de 12:02 não vista no tick de 12:01 (janela de 2 min)'; END IF;
  -- reminders: soneca com notified_at (FM-7)
  IF NOT (public.notify_tick_work('2099-03-03 12:00:59+00', 0)->>'reminders_due')::boolean THEN
    RAISE EXCEPTION 'PO-2 FM-7: soneca vencendo no minuto não detectada'; END IF;
  -- LA start: lead 60 (+) e lead 30 (−); dose não crítica (a) nunca conta
  IF NOT (public.notify_tick_work('2099-03-04 12:00:00+00', 60)->>'la_start_due')::boolean THEN
    RAISE EXCEPTION 'PO-2 LA start (+)'; END IF;
  IF (public.notify_tick_work('2099-03-04 12:00:00+00', 30)->>'la_start_due')::boolean THEN
    RAISE EXCEPTION 'PO-2 LA start (−) lead 30'; END IF;
  IF (public.notify_tick_work('2099-03-01 11:30:00+00', 60)->>'la_start_due')::boolean THEN
    RAISE EXCEPTION 'PO-2 LA start (−) não crítica contou'; END IF;
  -- LA lifecycle: dentro de 24h (+) e depois (−)
  IF NOT (public.notify_tick_work('2099-03-05 23:00:00+00', 60)->>'la_active')::boolean THEN
    RAISE EXCEPTION 'PO-2 LA active (+)'; END IF;
  IF (public.notify_tick_work('2099-03-06 00:00:01+00', 60)->>'la_active')::boolean THEN
    RAISE EXCEPTION 'PO-2 LA active (−) > 24h'; END IF;
  -- profiles: o titular de teste aparece como perfil (sem user_id)
  r := public.notify_tick_work('2099-03-01 12:00:30+00', 60);
  IF r::text LIKE '%10900000-0000-0000-0000-00000000000a%' THEN RAISE EXCEPTION 'PO-SEC: user_id vazou em profiles'; END IF;
  IF jsonb_array_length(r->'profiles') < 1 THEN RAISE EXCEPTION 'profiles vazio com user_settings semeado'; END IF;
END $$;

-- ─── 4. Outbox: pending (+), processing recente (−), processing preso (+, FM-8) ────────────
DO $$
DECLARE v_base boolean;
BEGIN
  v_base := (public.notify_tick_work(now(), 60)->>'outbox_pending')::boolean;
  IF v_base THEN
    RAISE NOTICE 'outbox já tem pendência real no QA — casos negativos de outbox pulados';
  ELSE
    INSERT INTO public.notification_outbox (user_id, kind, period_key, status, claimed_at)
      VALUES ('10900000-0000-0000-0000-00000000000a', 'daily_adherence', 't109-proc', 'processing', now() - interval '1 minute');
    IF (public.notify_tick_work(now(), 60)->>'outbox_pending')::boolean THEN
      RAISE EXCEPTION 'PO-2 outbox (−): processing recente contou'; END IF;
    UPDATE public.notification_outbox SET claimed_at = now() - interval '16 minutes' WHERE period_key = 't109-proc';
    IF NOT (public.notify_tick_work(now(), 60)->>'outbox_pending')::boolean THEN
      RAISE EXCEPTION 'PO-2 FM-8: processing preso não contou'; END IF;
    UPDATE public.notification_outbox SET status = 'sent', claimed_at = NULL WHERE period_key = 't109-proc';
    INSERT INTO public.notification_outbox (user_id, kind, period_key, status)
      VALUES ('10900000-0000-0000-0000-00000000000a', 'weekly_adherence', 't109-pend', 'pending');
    IF NOT (public.notify_tick_work(now(), 60)->>'outbox_pending')::boolean THEN
      RAISE EXCEPTION 'PO-2 outbox (+): pending não contou'; END IF;
  END IF;
END $$;

-- ─── 5. Índices criados ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname IN
      ('idx_dose_instances_pending_scheduled','idx_dose_instances_snoozed','idx_dose_instances_la_token')) <> 3 THEN
    RAISE EXCEPTION 'índices parciais ausentes'; END IF;
END $$;

DO $$ BEGIN RAISE EXCEPTION 'RESULT 109: todas as asserções passaram (rollback intencional)'; END $$;
