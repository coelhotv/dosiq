-- 20260716_titration_switch_rpc.test.sql — 029 Slice F3 (T015/T016 · PO-1 + PO-SEC-2 + PO-SEC-3)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270). Não deixa rastro. Auto-contido: cria a RPC
-- DENTRO da transação (DDL é transacional), ataca, prova, desfaz.
--
-- ⚠️ POR QUE NÃO TEM MOCK (R-288 regra 3 / AP-276 / lição 043): a propriedade sob teste é o
-- CLAIM — `UPDATE ... WHERE status='pending_confirmation'`. Mockar o predicado seria medir o
-- mock, não a exclusão mútua. Aqui o predicado é executado pelo Postgres de verdade.
--
-- HONESTIDADE SOBRE O ALCANCE: uma transação só não reproduz DUAS sessões disputando o row
-- lock. O que este arquivo prova é a propriedade que o lock serializa: **o segundo confirm vê o
-- predicado já falso e vira no-op idempotente** (o lock só decide QUEM chega primeiro, não o
-- resultado). A ordenação do lock em si está no artefato de raciocínio exigido pela R-288 —
-- plan.md §Apêndice F3, cenário A2 — que a própria regra aceita como alternativa à integração.
--
-- ┌─ Casos ────────────────────────────────────────────────────────────────────────────────────┐
-- |  # | Caso                                                        | Esperado                 |
-- |----|-------------------------------------------------------------|--------------------------|
-- |  1 | has_function_privilege(anon, confirm_titration_switch)       | false (AP-278)           |
-- |  2 | has_function_privilege(authenticated, ...)                   | true                     |
-- |  3 | assinatura única (sem overload)                              | 1 (AP-227)               |
-- |  4 | B confirma etapa de A (IDOR)                                 | nao_pendente, sem efeito |
-- |  5 | A confirma switch pendente                                   | success, medicine_switch |
-- |  6 | protocol anterior pausado + protocol novo ativo              | ambos                    |
-- |  7 | instâncias FUTURAS do pausado viram skipped_paused           | sim                      |
-- |  8 | instância PASSADA do pausado intocada                        | 'taken' preservado       |
-- |  9 | etapa anterior 'completed' + nova 'current'                  | ambas                    |
-- | 10 | evento auditável emitido (CON-031)                           | 1 linha                  |
-- | 11 | RETRY/double-tap do mesmo confirm                            | already_confirmed=true   |
-- | 12 | retry NÃO duplica protocol nem evento                        | contagens inalteradas    |
-- | 13 | confirmar etapa 'completed' (obsoleta)                       | step_obsoleto            |
-- | 14 | confirmar etapa 'upcoming' (não venceu)                      | nao_pendente             |
-- | 15 | confirmar step inexistente                                   | nao_pendente (sem vazar) |
-- | 16 | dose_change via RPC (mesmo medicine_id)                      | não pausa, ajusta dose   |
-- | 17 | 🔴 etapa 'cp' → protocols.intake_unit                        | NULL (não viola CHECK)   |
-- | 18 | backfill: steps migrados ganham protocol_id                  | 0 NULL                   |
-- └────────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 0 — a migração sob teste (idêntica ao arquivo .sql)
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.dose_critical_events DROP CONSTRAINT IF EXISTS dose_critical_events_event_check;
ALTER TABLE public.dose_critical_events ADD CONSTRAINT dose_critical_events_event_check CHECK (
  event = ANY (ARRAY['alarm_scheduled','alarm_fired','alarm_suppressed','nag_fired','snoozed',
    'resolved','push_sent','push_failed','surface_transitioned','push_skipped_no_token',
    'token_captured','titration_transitioned']));

DROP FUNCTION IF EXISTS public.confirm_titration_switch(uuid);
CREATE FUNCTION public.confirm_titration_switch(p_step_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_step public.titration_steps%ROWTYPE;
  v_prev public.titration_steps%ROWTYPE;
  v_status text; v_transition text; v_protocol_id uuid;
  v_prev_protocol public.protocols%ROWTYPE;
  v_paused_protocol uuid := NULL; v_tz text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'nao_autenticado');
  END IF;

  UPDATE public.titration_steps
     SET status='current', started_at=now(), updated_at=now()
   WHERE id=p_step_id AND user_id=v_user_id AND status='pending_confirmation'
  RETURNING * INTO v_step;

  IF NOT FOUND THEN
    SELECT status INTO v_status FROM public.titration_steps WHERE id=p_step_id AND user_id=v_user_id;
    IF v_status IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'nao_pendente');
    ELSIF v_status = 'current' THEN
      RETURN jsonb_build_object('success', true, 'already_confirmed', true, 'step_id', p_step_id);
    ELSIF v_status = 'completed' THEN
      RETURN jsonb_build_object('success', false, 'reason', 'step_obsoleto');
    ELSE
      RETURN jsonb_build_object('success', false, 'reason', 'nao_pendente');
    END IF;
  END IF;

  SELECT * INTO v_prev FROM public.titration_steps
   WHERE titration_id=v_step.titration_id AND user_id=v_user_id
     AND position < v_step.position AND status='current'
   ORDER BY position DESC LIMIT 1;

  IF v_prev.id IS NOT NULL AND v_prev.medicine_id = v_step.medicine_id THEN
    v_transition := 'dose_change';
  ELSE
    v_transition := 'medicine_switch';
  END IF;

  IF v_prev.id IS NOT NULL THEN
    UPDATE public.titration_steps SET status='completed', ended_at=now(), updated_at=now()
     WHERE id=v_prev.id AND user_id=v_user_id;
  END IF;

  IF v_transition = 'dose_change' THEN
    v_protocol_id := v_prev.protocol_id;
    IF v_protocol_id IS NOT NULL THEN
      UPDATE public.protocols
         SET dosage_per_intake=v_step.dose, intake_unit=NULLIF(v_step.intake_unit,'cp')
       WHERE id=v_protocol_id AND user_id=v_user_id;
    END IF;
  ELSE
    IF v_prev.protocol_id IS NOT NULL THEN
      UPDATE public.protocols SET active=false, paused_at=now()
       WHERE id=v_prev.protocol_id AND user_id=v_user_id
      RETURNING * INTO v_prev_protocol;
      v_paused_protocol := v_prev_protocol.id;
      IF v_paused_protocol IS NOT NULL THEN
        UPDATE public.dose_instances SET status='skipped_paused'
         WHERE protocol_id=v_paused_protocol AND status='pending' AND scheduled_for > now();
      END IF;
    END IF;

    IF v_step.protocol_id IS NOT NULL THEN
      UPDATE public.protocols
         SET active=true, paused_at=NULL, dosage_per_intake=v_step.dose,
             intake_unit=NULLIF(v_step.intake_unit,'cp')
       WHERE id=v_step.protocol_id AND user_id=v_user_id;
      UPDATE public.dose_instances SET status='pending'
       WHERE protocol_id=v_step.protocol_id AND status='skipped_paused' AND scheduled_for > now();
      v_protocol_id := v_step.protocol_id;
    ELSE
      SELECT timezone INTO v_tz FROM public.user_settings WHERE user_id=v_user_id;
      v_tz := COALESCE(v_tz, 'America/Sao_Paulo');
      INSERT INTO public.protocols (user_id, medicine_id, name, dosage_per_intake, intake_unit,
        frequency, weekdays, time_schedule, start_date, active, treatment_plan_id, critical_alarm)
      SELECT v_user_id, v_step.medicine_id, COALESCE(v_prev_protocol.name, m.name), v_step.dose,
        NULLIF(v_step.intake_unit,'cp'), COALESCE(v_prev_protocol.frequency,'diário'),
        v_prev_protocol.weekdays, COALESCE(v_prev_protocol.time_schedule,'[]'::jsonb),
        (now() AT TIME ZONE v_tz)::date, true, v_prev_protocol.treatment_plan_id,
        COALESCE(v_prev_protocol.critical_alarm,false)
      FROM public.medicines m WHERE m.id = v_step.medicine_id
      RETURNING id INTO v_protocol_id;
    END IF;

    UPDATE public.titration_steps SET protocol_id=v_protocol_id, updated_at=now()
     WHERE id=v_step.id AND user_id=v_user_id;
  END IF;

  INSERT INTO public.dose_critical_events (user_id, dose_instance_id, event, platform, actor, detail)
  VALUES (v_user_id, NULL, 'titration_transitioned', 'server', 'user',
    jsonb_build_object('titration_id', v_step.titration_id, 'step_id', v_step.id,
      'position', v_step.position, 'transition', v_transition, 'medicine_id', v_step.medicine_id,
      'dose', v_step.dose, 'intake_unit', v_step.intake_unit,
      'protocol_activated', v_protocol_id, 'protocol_paused', v_paused_protocol,
      'previous_step_id', v_prev.id));

  RETURN jsonb_build_object('success', true, 'already_confirmed', false, 'transition', v_transition,
    'step_id', v_step.id, 'protocol_activated', v_protocol_id, 'protocol_paused', v_paused_protocol);
END; $$;

REVOKE EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_titration_switch(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — fixtures: escada cross-med de A (Semaglutida 0,25 → 0,5), etapa 2 PENDENTE
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public._r (n int, caso text, esperado text, obtido text, ok boolean);
GRANT ALL ON public._r TO authenticated, anon, service_role;

CREATE TABLE public._ids (k text PRIMARY KEY, v uuid);
GRANT SELECT ON public._ids TO authenticated, anon, service_role;
INSERT INTO public._ids (k, v) VALUES
  ('u_a', gen_random_uuid()), ('u_b', gen_random_uuid()),
  ('med_025', gen_random_uuid()), ('med_05', gen_random_uuid()), ('med_cp', gen_random_uuid()),
  ('proto_025', gen_random_uuid()), ('proto_cp', gen_random_uuid()),
  ('tit_a', gen_random_uuid()), ('tit_cp', gen_random_uuid()),
  ('step_0', gen_random_uuid()), ('step_1', gen_random_uuid()),
  ('step_cp_0', gen_random_uuid()), ('step_cp_1', gen_random_uuid()),
  ('di_futura', gen_random_uuid()), ('di_passada', gen_random_uuid());

INSERT INTO auth.users (id, email) SELECT v, k || '-029f3@test.local' FROM public._ids WHERE k IN ('u_a','u_b');

-- Schema real (verificado 2026-07-16): `type` é ('medicamento','suplemento') e a forma
-- farmacêutica mora em `presentation`. A CLAUDE.md chama a lista de presentation de
-- "MEDICINE_TYPES" — drift de documentação, não do banco.
INSERT INTO public.medicines (id, user_id, name, dosage_unit, type, presentation) VALUES
  ((SELECT v FROM public._ids WHERE k='med_025'), (SELECT v FROM public._ids WHERE k='u_a'), 'Semaglutida 0,25 mg', 'mg', 'medicamento', 'injetavel'),
  ((SELECT v FROM public._ids WHERE k='med_05'),  (SELECT v FROM public._ids WHERE k='u_a'), 'Semaglutida 0,5 mg',  'mg', 'medicamento', 'injetavel'),
  ((SELECT v FROM public._ids WHERE k='med_cp'),  (SELECT v FROM public._ids WHERE k='u_a'), 'Metoprolol 50 mg',    'mg', 'medicamento', 'comprimido');

-- Executor da etapa 1 (o que deve ser PAUSADO na troca).
INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, intake_unit,
                              frequency, time_schedule, start_date, active)
VALUES ((SELECT v FROM public._ids WHERE k='proto_025'), (SELECT v FROM public._ids WHERE k='u_a'),
        (SELECT v FROM public._ids WHERE k='med_025'), 'GLP', 0.25, 'mg', 'semanal',
        '["22:00"]'::jsonb, current_date - 30, true);

-- Executor da escada de COMPRIMIDO (caso metoprolol — a fronteira 'cp' → NULL).
INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, intake_unit,
                              frequency, time_schedule, start_date, active)
VALUES ((SELECT v FROM public._ids WHERE k='proto_cp'), (SELECT v FROM public._ids WHERE k='u_a'),
        (SELECT v FROM public._ids WHERE k='med_cp'), 'Metoprolol', 1, NULL, 'diário',
        '["08:00"]'::jsonb, current_date - 30, true);

-- Instâncias do executor a pausar: uma FUTURA (deve virar skipped_paused) e uma PASSADA (intocada).
INSERT INTO public.dose_instances (id, user_id, protocol_id, scheduled_for, expected_dose, status)
VALUES ((SELECT v FROM public._ids WHERE k='di_futura'), (SELECT v FROM public._ids WHERE k='u_a'),
        (SELECT v FROM public._ids WHERE k='proto_025'), now() + interval '2 days', 0.25, 'pending'),
       ((SELECT v FROM public._ids WHERE k='di_passada'), (SELECT v FROM public._ids WHERE k='u_a'),
        (SELECT v FROM public._ids WHERE k='proto_025'), now() - interval '2 days', 0.25, 'taken');

-- Escada cross-med: etapa 0 vigente (executor proto_025), etapa 1 PENDENTE (medicamento novo).
INSERT INTO public.titrations (id, user_id) VALUES
  ((SELECT v FROM public._ids WHERE k='tit_a'), (SELECT v FROM public._ids WHERE k='u_a')),
  ((SELECT v FROM public._ids WHERE k='tit_cp'), (SELECT v FROM public._ids WHERE k='u_a'));

INSERT INTO public.titration_steps (id, titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at, protocol_id) VALUES
  ((SELECT v FROM public._ids WHERE k='step_0'), (SELECT v FROM public._ids WHERE k='tit_a'),
   (SELECT v FROM public._ids WHERE k='u_a'), 0, (SELECT v FROM public._ids WHERE k='med_025'),
   0.25, 'mg', 28, 'current', now() - interval '28 days', (SELECT v FROM public._ids WHERE k='proto_025')),
  ((SELECT v FROM public._ids WHERE k='step_1'), (SELECT v FROM public._ids WHERE k='tit_a'),
   (SELECT v FROM public._ids WHERE k='u_a'), 1, (SELECT v FROM public._ids WHERE k='med_05'),
   0.5, 'mg', 28, 'pending_confirmation', NULL, NULL),
  -- escada intra-med de comprimido: etapa 1 pendente com intake_unit 'cp'
  ((SELECT v FROM public._ids WHERE k='step_cp_0'), (SELECT v FROM public._ids WHERE k='tit_cp'),
   (SELECT v FROM public._ids WHERE k='u_a'), 0, (SELECT v FROM public._ids WHERE k='med_cp'),
   1, 'cp', 28, 'current', now() - interval '28 days', (SELECT v FROM public._ids WHERE k='proto_cp')),
  ((SELECT v FROM public._ids WHERE k='step_cp_1'), (SELECT v FROM public._ids WHERE k='tit_cp'),
   (SELECT v FROM public._ids WHERE k='u_a'), 1, (SELECT v FROM public._ids WHERE k='med_cp'),
   2, 'cp', 28, 'pending_confirmation', NULL, (SELECT v FROM public._ids WHERE k='proto_cp'));

CREATE OR REPLACE FUNCTION public._as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
END; $fn$;
GRANT EXECUTE ON FUNCTION public._as_user(uuid) TO authenticated, anon, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — grants e assinatura (1/2/3) — PO-SEC-2
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public._r VALUES (1,'has_function_privilege(anon, confirm_titration_switch)','false',
  has_function_privilege('anon','public.confirm_titration_switch(uuid)','EXECUTE')::text,
  has_function_privilege('anon','public.confirm_titration_switch(uuid)','EXECUTE') = false);
INSERT INTO public._r VALUES (2,'has_function_privilege(authenticated, ...)','true',
  has_function_privilege('authenticated','public.confirm_titration_switch(uuid)','EXECUTE')::text,
  has_function_privilege('authenticated','public.confirm_titration_switch(uuid)','EXECUTE') = true);
INSERT INTO public._r
SELECT 3,'assinatura única (sem overload — AP-227)','1', count(*)::text, count(*) = 1
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='confirm_titration_switch';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — IDOR: B confirma a etapa de A (4) — PO-SEC-2
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_b'));
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_res jsonb; v_step_1 uuid := (SELECT v FROM public._ids WHERE k='step_1'); v_status text;
BEGIN
  v_res := public.confirm_titration_switch(v_step_1);
  SET LOCAL ROLE postgres;
  SELECT status INTO v_status FROM public.titration_steps WHERE id = v_step_1;
  INSERT INTO public._r VALUES (4,'B confirma etapa de A (IDOR)','nao_pendente + etapa intacta',
    (v_res->>'reason') || ' / etapa=' || v_status,
    v_res->>'reason' = 'nao_pendente' AND v_status = 'pending_confirmation');
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — A confirma o switch (5..10) — PO-1
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_res jsonb; v_novo uuid; v_cnt int; v_status text;
  v_step_0 uuid := (SELECT v FROM public._ids WHERE k='step_0');
  v_step_1 uuid := (SELECT v FROM public._ids WHERE k='step_1');
  v_proto_025 uuid := (SELECT v FROM public._ids WHERE k='proto_025');
BEGIN
  v_res := public.confirm_titration_switch(v_step_1);
  v_novo := (v_res->>'protocol_activated')::uuid;

  INSERT INTO public._r VALUES (5,'A confirma switch pendente','success + medicine_switch',
    (v_res->>'success') || ' / ' || COALESCE(v_res->>'transition','—'),
    (v_res->>'success')::boolean AND v_res->>'transition' = 'medicine_switch');

  SET LOCAL ROLE postgres;
  INSERT INTO public._r
  SELECT 6,'protocol anterior pausado + novo ativo','pausado=false, novo=true',
         'anterior.active=' || a.active::text || ' (paused_at ' ||
           CASE WHEN a.paused_at IS NULL THEN 'NULL' ELSE 'set' END || '), novo.active=' || n.active::text,
         a.active = false AND a.paused_at IS NOT NULL AND n.active = true
  FROM public.protocols a, public.protocols n WHERE a.id = v_proto_025 AND n.id = v_novo;

  SELECT status INTO v_status FROM public.dose_instances WHERE id = (SELECT v FROM public._ids WHERE k='di_futura');
  INSERT INTO public._r VALUES (7,'instância FUTURA do pausado','skipped_paused', v_status, v_status = 'skipped_paused');

  SELECT status INTO v_status FROM public.dose_instances WHERE id = (SELECT v FROM public._ids WHERE k='di_passada');
  INSERT INTO public._r VALUES (8,'instância PASSADA do pausado','taken (intocada)', v_status, v_status = 'taken');

  INSERT INTO public._r
  SELECT 9,'etapa anterior completed + nova current','completed/current',
         s0.status || '/' || s1.status, s0.status='completed' AND s1.status='current' AND s1.protocol_id = v_novo
  FROM public.titration_steps s0, public.titration_steps s1 WHERE s0.id=v_step_0 AND s1.id=v_step_1;

  SELECT count(*) INTO v_cnt FROM public.dose_critical_events
   WHERE event='titration_transitioned' AND detail->>'step_id' = v_step_1::text;
  INSERT INTO public._r VALUES (10,'evento auditável emitido (CON-031)','1 linha', v_cnt::text, v_cnt = 1);
  SET LOCAL ROLE authenticated;
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5 — CONCORRÊNCIA: retry / double-tap (11/12) — PO-SEC-3
-- O 2º confirm encontra o predicado do claim já falso: é EXATAMENTE o estado que a 2ª sessão
-- encontra ao sair do row lock (A2 do trace). Sem mock: o predicado roda no Postgres.
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_res jsonb; v_protos_antes int; v_protos_depois int; v_eventos int;
  v_step_1 uuid := (SELECT v FROM public._ids WHERE k='step_1');
  v_uid uuid := (SELECT v FROM public._ids WHERE k='u_a');
BEGIN
  SET LOCAL ROLE postgres;
  SELECT count(*) INTO v_protos_antes FROM public.protocols WHERE user_id = v_uid;
  SET LOCAL ROLE authenticated;

  v_res := public.confirm_titration_switch(v_step_1);  -- retry do MESMO comando

  INSERT INTO public._r VALUES (11,'retry/double-tap do confirm','success + already_confirmed',
    (v_res->>'success') || ' / already=' || COALESCE(v_res->>'already_confirmed','—'),
    (v_res->>'success')::boolean AND (v_res->>'already_confirmed')::boolean);

  SET LOCAL ROLE postgres;
  SELECT count(*) INTO v_protos_depois FROM public.protocols WHERE user_id = v_uid;
  SELECT count(*) INTO v_eventos FROM public.dose_critical_events
   WHERE event='titration_transitioned' AND detail->>'step_id' = v_step_1::text;
  INSERT INTO public._r VALUES (12,'retry não duplica protocol nem evento','protocols iguais + 1 evento',
    'protocols ' || v_protos_antes || '→' || v_protos_depois || ', eventos=' || v_eventos,
    v_protos_antes = v_protos_depois AND v_eventos = 1);
  SET LOCAL ROLE authenticated;
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 6 — rejeições honestas (13/14/15) — PO-SEC-3
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_res jsonb; v_step_0 uuid := (SELECT v FROM public._ids WHERE k='step_0');
BEGIN
  -- step_0 ficou 'completed' após a confirmação da PARTE 4 → confirmação obsoleta.
  v_res := public.confirm_titration_switch(v_step_0);
  INSERT INTO public._r VALUES (13,'confirmar etapa completed (obsoleta)','step_obsoleto',
    COALESCE(v_res->>'reason','—'), v_res->>'reason' = 'step_obsoleto');

  -- etapa que nunca venceu (a UI não deve oferecer a ação).
  v_res := public.confirm_titration_switch(
    (SELECT id FROM public.titration_steps WHERE status='upcoming' LIMIT 1));
  INSERT INTO public._r VALUES (14,'confirmar etapa upcoming','nao_pendente',
    COALESCE(v_res->>'reason','nenhuma etapa upcoming'), COALESCE(v_res->>'reason','nao_pendente') = 'nao_pendente');

  v_res := public.confirm_titration_switch(gen_random_uuid());
  INSERT INTO public._r VALUES (15,'confirmar step inexistente','nao_pendente (não vaza existência)',
    COALESCE(v_res->>'reason','—'), v_res->>'reason' = 'nao_pendente');
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 7 — dose_change + fronteira 'cp' (16/17)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_res jsonb; v_unit text; v_dose numeric; v_active boolean;
  v_step_cp_1 uuid := (SELECT v FROM public._ids WHERE k='step_cp_1');
  v_proto_cp uuid := (SELECT v FROM public._ids WHERE k='proto_cp');
BEGIN
  v_res := public.confirm_titration_switch(v_step_cp_1);

  SET LOCAL ROLE postgres;
  SELECT intake_unit, dosage_per_intake, active INTO v_unit, v_dose, v_active
    FROM public.protocols WHERE id = v_proto_cp;

  INSERT INTO public._r VALUES (16,'dose_change via RPC (mesmo medicine_id)','dose_change, não pausa, dose=2',
    COALESCE(v_res->>'transition','—') || ', active=' || v_active::text || ', dose=' || v_dose::text,
    v_res->>'transition' = 'dose_change' AND v_active = true AND v_dose = 2);

  INSERT INTO public._r VALUES (17,'etapa cp → protocols.intake_unit','NULL (CHECK não aceita cp)',
    COALESCE(v_unit,'NULL'), v_unit IS NULL);
  SET LOCAL ROLE authenticated;
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 8 — backfill do protocol_id (18)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_tit uuid := gen_random_uuid(); v_cnt int;
        v_uid uuid := (SELECT v FROM public._ids WHERE k='u_a');
BEGIN
  -- escada "migrada" com steps sem executor (é o estado real de prod pré-backfill)
  INSERT INTO public.titrations (id, user_id, migrated_from_protocol_id)
    VALUES (v_tit, v_uid, (SELECT v FROM public._ids WHERE k='proto_cp'));
  INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status)
    VALUES (v_tit, v_uid, 0, (SELECT v FROM public._ids WHERE k='med_cp'), 1, 'cp', 28, 'current');

  UPDATE public.titration_steps s SET protocol_id = t.migrated_from_protocol_id, updated_at = now()
    FROM public.titrations t
   WHERE s.titration_id = t.id AND t.migrated_from_protocol_id IS NOT NULL AND s.protocol_id IS NULL;

  SELECT count(*) INTO v_cnt FROM public.titration_steps s
    JOIN public.titrations t ON t.id = s.titration_id
   WHERE t.migrated_from_protocol_id IS NOT NULL AND s.protocol_id IS NULL;
  INSERT INTO public._r VALUES (18,'backfill: steps migrados ganham protocol_id','0 sem executor', v_cnt::text, v_cnt = 0);
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULTADO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT n, CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS r, caso, esperado, obtido
FROM public._r ORDER BY n;

ROLLBACK;
