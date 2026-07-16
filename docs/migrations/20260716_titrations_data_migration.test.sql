-- 20260716_titrations_data_migration.test.sql — 029 Slice F2 (T009 / PO-SEC-4)
--
-- BEGIN..ROLLBACK contra o banco REAL. Não deixa rastro. Semeia 3 protocolos N1
-- (titulando / pausado / alvo_atingido), roda a migração de DADOS inline (idêntica ao
-- arquivo `20260716_titrations_data_migration.sql`), prova o mapa de estados + contagens +
-- jsonb INTACTO, e desfaz tudo. Rodar ANTES de aplicar em prod (só após aprovação do PO).
--
-- Pré-condição: tabelas titrations/titration_steps já existem em prod (F1 / PR #746).
--
-- ┌─ PO-SEC-4 — migração N1→N2 não-destrutiva e verificável ───────────────────────────────────┐
-- |  1 | contagem escadas migradas = protocolos N1 com schedule (=3)      | ok                   |
-- |  2 | contagem etapas criadas = soma de estágios jsonb (=9)            | ok                   |
-- |  3 | titulando: etapa vigente (pos=current_stage_index) status current + started_at | ok      |
-- |  4 | titulando: pos < current = completed; pos > current = upcoming   | ok                   |
-- |  5 | alvo_atingido: última etapa status current E duration_days NULL  | ok                   |
-- |  6 | pausado: NENHUMA etapa status current                            | ok                   |
-- |  7 | jsonb dos 3 protocolos byte-idêntico antes/depois (read-only)    | ok                   |
-- |  8 | intake_unit sólido (NULL no protocol) migra p/ 'cp'              | ok                   |
-- |  9 | re-executar a migração cria 0 escadas e 0 etapas (idempotente)   | ok                   |
-- └────────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- Tabelas auxiliares TEMP (sem troca de role neste teste): evitam poluir o catálogo public
-- e colisão entre execuções concorrentes. Caem sozinhas no fim da sessão / ROLLBACK.
CREATE TEMP TABLE _r (n int, caso text, esperado text, obtido text, ok boolean);
CREATE TEMP TABLE _ids (k text PRIMARY KEY, v uuid);
INSERT INTO _ids (k, v) VALUES
  ('u', gen_random_uuid()),
  ('med', gen_random_uuid()),
  ('p_titulando', gen_random_uuid()),
  ('p_pausado', gen_random_uuid()),
  ('p_alvo', gen_random_uuid());

INSERT INTO auth.users (id, email)
  VALUES ((SELECT v FROM _ids WHERE k='u'), 'f2-029@test.local');

INSERT INTO public.medicines (id, user_id, name, dosage_unit, type)
  VALUES ((SELECT v FROM _ids WHERE k='med'), (SELECT v FROM _ids WHERE k='u'),
          'Semaglutida F2', 'mg', 'medicamento');

-- Escada 3 estágios (0,25 → 0,5 → 1,0 mg, 28d). intake_unit NULL = sólido → migra p/ 'cp' (caso 8).
-- p_titulando: current_stage_index=1, titulando
INSERT INTO public.protocols (id, user_id, medicine_id, name, start_date, titration_schedule,
                              current_stage_index, stage_started_at, titration_status)
VALUES ((SELECT v FROM _ids WHERE k='p_titulando'), (SELECT v FROM _ids WHERE k='u'),
        (SELECT v FROM _ids WHERE k='med'), 'Titulando', '2026-03-01',
        '[{"dosage":0.25,"duration_days":28},{"dosage":0.5,"duration_days":28},{"dosage":1.0,"duration_days":28}]'::jsonb,
        1, '2026-03-01T00:00:00', 'titulando');
-- p_pausado
INSERT INTO public.protocols (id, user_id, medicine_id, name, start_date, titration_schedule,
                              current_stage_index, stage_started_at, titration_status)
VALUES ((SELECT v FROM _ids WHERE k='p_pausado'), (SELECT v FROM _ids WHERE k='u'),
        (SELECT v FROM _ids WHERE k='med'), 'Pausado', '2026-03-01',
        '[{"dosage":0.25,"duration_days":28},{"dosage":0.5,"duration_days":28},{"dosage":1.0,"duration_days":28}]'::jsonb,
        1, '2026-03-01T00:00:00', 'pausado');
-- p_alvo: last stage reached
INSERT INTO public.protocols (id, user_id, medicine_id, name, start_date, titration_schedule,
                              current_stage_index, stage_started_at, titration_status)
VALUES ((SELECT v FROM _ids WHERE k='p_alvo'), (SELECT v FROM _ids WHERE k='u'),
        (SELECT v FROM _ids WHERE k='med'), 'Alvo', '2026-03-01',
        '[{"dosage":0.25,"duration_days":28},{"dosage":0.5,"duration_days":28},{"dosage":1.0,"duration_days":28}]'::jsonb,
        2, '2026-03-01T00:00:00', 'alvo_atingido');

-- Snapshot do jsonb ANTES (caso 7).
CREATE TEMP TABLE _jb AS
  SELECT id, titration_schedule FROM public.protocols
  WHERE id IN (SELECT v FROM _ids WHERE k IN ('p_titulando','p_pausado','p_alvo'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO (idêntica ao arquivo 20260716_titrations_data_migration.sql)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_created int; v_steps int;
BEGIN
  INSERT INTO public.titrations (user_id, treatment_plan_id, migrated_from_protocol_id)
  SELECT p.user_id, p.treatment_plan_id, p.id
  FROM public.protocols p
  WHERE p.titration_schedule IS NOT NULL
    AND jsonb_typeof(p.titration_schedule) = 'array'
    AND jsonb_array_length(p.titration_schedule) > 0
    AND NOT EXISTS (SELECT 1 FROM public.titrations t WHERE t.migrated_from_protocol_id = p.id);
  GET DIAGNOSTICS v_created = ROW_COUNT;

  INSERT INTO public.titration_steps
    (titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at)
  SELECT
    t.id, p.user_id, (stage.ord - 1)::int, p.medicine_id,
    (stage.val->>'dosage')::numeric, COALESCE(p.intake_unit, 'cp'),
    CASE WHEN p.titration_status = 'alvo_atingido' AND stage.ord = cnt.n THEN NULL
         ELSE COALESCE((stage.val->>'duration_days')::int, (stage.val->>'days')::int) END,
    CASE
      WHEN p.titration_status = 'titulando' THEN
        CASE WHEN (stage.ord - 1) < COALESCE(p.current_stage_index,0) THEN 'completed'
             WHEN (stage.ord - 1) = COALESCE(p.current_stage_index,0) THEN 'current'
             ELSE 'upcoming' END
      WHEN p.titration_status = 'alvo_atingido' THEN
        CASE WHEN stage.ord = cnt.n THEN 'current' ELSE 'completed' END
      ELSE CASE WHEN (stage.ord - 1) < COALESCE(p.current_stage_index,0) THEN 'completed' ELSE 'upcoming' END
    END,
    CASE
      WHEN p.titration_status = 'titulando' AND (stage.ord - 1) = COALESCE(p.current_stage_index,0) THEN p.stage_started_at
      WHEN p.titration_status = 'alvo_atingido' AND stage.ord = cnt.n THEN p.stage_started_at
      ELSE NULL END
  FROM public.titrations t
  JOIN public.protocols p ON p.id = t.migrated_from_protocol_id
  CROSS JOIN LATERAL jsonb_array_elements(p.titration_schedule) WITH ORDINALITY AS stage(val, ord)
  CROSS JOIN LATERAL (SELECT jsonb_array_length(p.titration_schedule) AS n) cnt
  WHERE t.migrated_from_protocol_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.titration_steps s WHERE s.titration_id = t.id);
  GET DIAGNOSTICS v_steps = ROW_COUNT;

  RAISE NOTICE 'seed migrado: % escada(s), % etapa(s)', v_created, v_steps;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ASSERÇÕES
-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. contagem escadas
INSERT INTO _r
SELECT 1, 'escadas migradas = 3', '3',
  (SELECT count(*)::text FROM public.titrations WHERE migrated_from_protocol_id IN
    (SELECT v FROM _ids WHERE k IN ('p_titulando','p_pausado','p_alvo'))),
  (SELECT count(*) FROM public.titrations WHERE migrated_from_protocol_id IN
    (SELECT v FROM _ids WHERE k IN ('p_titulando','p_pausado','p_alvo'))) = 3;

-- 2. contagem etapas = 9
INSERT INTO _r
SELECT 2, 'etapas criadas = 9', '9',
  (SELECT count(*)::text FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
     WHERE t.migrated_from_protocol_id IN (SELECT v FROM _ids WHERE k IN ('p_titulando','p_pausado','p_alvo'))),
  (SELECT count(*) FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
     WHERE t.migrated_from_protocol_id IN (SELECT v FROM _ids WHERE k IN ('p_titulando','p_pausado','p_alvo'))) = 9;

-- 3. titulando: pos1 current + started_at
INSERT INTO _r
SELECT 3, 'titulando: pos1 current + started_at not null', 'current/true',
  s.status || '/' || (s.started_at IS NOT NULL)::text, s.status='current' AND s.started_at IS NOT NULL
FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
WHERE t.migrated_from_protocol_id=(SELECT v FROM _ids WHERE k='p_titulando') AND s.position=1;

-- 4. titulando: pos0 completed, pos2 upcoming
INSERT INTO _r
SELECT 4, 'titulando: pos0=completed, pos2=upcoming', 'completed/upcoming',
  string_agg(s.status, '/' ORDER BY s.position),
  bool_and((s.position=0 AND s.status='completed') OR (s.position=2 AND s.status='upcoming'))
FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
WHERE t.migrated_from_protocol_id=(SELECT v FROM _ids WHERE k='p_titulando') AND s.position IN (0,2);

-- 5. alvo: última etapa current + duration_days NULL
INSERT INTO _r
SELECT 5, 'alvo: pos2 current + duration_days NULL', 'current/NULL',
  s.status || '/' || COALESCE(s.duration_days::text,'NULL'),
  s.status='current' AND s.duration_days IS NULL
FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
WHERE t.migrated_from_protocol_id=(SELECT v FROM _ids WHERE k='p_alvo') AND s.position=2;

-- 6. pausado: nenhuma etapa current
INSERT INTO _r
SELECT 6, 'pausado: 0 etapas current', '0',
  (SELECT count(*)::text FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
     WHERE t.migrated_from_protocol_id=(SELECT v FROM _ids WHERE k='p_pausado') AND s.status='current'),
  (SELECT count(*) FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
     WHERE t.migrated_from_protocol_id=(SELECT v FROM _ids WHERE k='p_pausado') AND s.status='current') = 0;

-- 7. jsonb byte-idêntico antes/depois
INSERT INTO _r
SELECT 7, 'jsonb intacto (read-only)', '0 diffs',
  (SELECT count(*)::text FROM _jb b JOIN public.protocols p ON p.id=b.id
     WHERE p.titration_schedule IS DISTINCT FROM b.titration_schedule),
  (SELECT count(*) FROM _jb b JOIN public.protocols p ON p.id=b.id
     WHERE p.titration_schedule IS DISTINCT FROM b.titration_schedule) = 0;

-- 8. intake_unit sólido → 'cp'
INSERT INTO _r
SELECT 8, 'intake_unit NULL migra p/ cp', 'cp',
  (SELECT DISTINCT s.intake_unit FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
     WHERE t.migrated_from_protocol_id=(SELECT v FROM _ids WHERE k='p_titulando') LIMIT 1),
  (SELECT bool_and(s.intake_unit='cp') FROM public.titration_steps s JOIN public.titrations t ON t.id=s.titration_id
     WHERE t.migrated_from_protocol_id IN (SELECT v FROM _ids WHERE k IN ('p_titulando','p_pausado','p_alvo')));

-- 9. idempotência: re-rodar cria 0
DO $$
DECLARE v_created int; v_steps int;
BEGIN
  INSERT INTO public.titrations (user_id, treatment_plan_id, migrated_from_protocol_id)
  SELECT p.user_id, p.treatment_plan_id, p.id FROM public.protocols p
  WHERE p.titration_schedule IS NOT NULL AND jsonb_typeof(p.titration_schedule)='array'
    AND jsonb_array_length(p.titration_schedule) > 0
    AND NOT EXISTS (SELECT 1 FROM public.titrations t WHERE t.migrated_from_protocol_id=p.id);
  GET DIAGNOSTICS v_created = ROW_COUNT;

  INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at)
  SELECT t.id, p.user_id, (stage.ord-1)::int, p.medicine_id, (stage.val->>'dosage')::numeric,
         COALESCE(p.intake_unit,'cp'),
         CASE WHEN p.titration_status='alvo_atingido' AND stage.ord=cnt.n THEN NULL
              ELSE COALESCE((stage.val->>'duration_days')::int,(stage.val->>'days')::int) END,
         'upcoming', NULL
  FROM public.titrations t JOIN public.protocols p ON p.id=t.migrated_from_protocol_id
  CROSS JOIN LATERAL jsonb_array_elements(p.titration_schedule) WITH ORDINALITY AS stage(val,ord)
  CROSS JOIN LATERAL (SELECT jsonb_array_length(p.titration_schedule) AS n) cnt
  WHERE t.migrated_from_protocol_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.titration_steps s WHERE s.titration_id=t.id);
  GET DIAGNOSTICS v_steps = ROW_COUNT;

  INSERT INTO _r VALUES (9, 'idempotente: re-run cria 0/0', '0 escada + 0 etapa',
    v_created||' escada + '||v_steps||' etapa', v_created=0 AND v_steps=0);
END $$;

SELECT n, CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS r, caso, esperado, obtido
FROM _r ORDER BY n;

ROLLBACK;
