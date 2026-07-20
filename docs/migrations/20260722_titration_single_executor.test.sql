-- 20260722_titration_single_executor.test.sql — 052 Slice C (T024/T025/T029b · PO-7/PO-8/PO-9)
--
-- BEGIN..ROLLBACK contra o banco REAL. A mudança É na RPC: um teste de JS mediria o mock
-- (família AP-279), então a prova tem de sair do Postgres. A própria migração é aplicada
-- DENTRO da transação — o arquivo roda antes de a RPC ir para prod e continua verde depois.
--
-- ┌─ Casos ────────────────────────────────────────────────────────────────────────────────────┐
-- |  # | Caso                                                                | Esperado         |
-- |----|---------------------------------------------------------------------|------------------|
-- | PO-7 — medicine_switch muta o executor vigente                                              |
-- |  1 | contagem de protocols do usuário NÃO muda na transição               | antes == depois  |
-- |  2 | o executor vigente passou a apontar para o medicamento NOVO          | med_B            |
-- |  3 | ... e para a dose da etapa nova                                       | 7.5              |
-- |  4 | NENHUM protocolo do usuário recebeu end_date pela transição           | 0                |
-- |  5 | NENHUM protocolo do usuário recebeu paused_at pela transição          | 0                |
-- |  6 | retorno: protocol_activated é o executor de sempre, não um novo       | P                |
-- |  7 | retorno: protocol_paused é null (não existe anterior para pausar)     | null             |
-- |  8 | idempotência: 2ª chamada devolve already_confirmed                    | true             |
-- |  9 | ... e não teve efeito (contagem de protocols segue igual)             | igual            |
-- | PO-8 — o passado não é reescrito (garantia dos Slices A/B sob o fluxo novo)                  |
-- | 10 | instância PASSADA: medicine_id segue o da época                       | med_A            |
-- | 11 | instância PASSADA: expected_dose segue o da época                     | 5                |
-- | 12 | instância passada NÃO virou skipped_paused (PO-1 como guard)          | taken            |
-- | 13 | instância FUTURA pending não foi pausada pela transição               | pending          |
-- | FR-009 — vínculo escada↔tratamento                                                          |
-- | 14 | TODAS as etapas da escada apontam para o executor único               | 0 sem vínculo    |
-- | PO-9 — escada nunca fica órfã (repro literal do bug de prod, 2026-07-20)                     |
-- | 15 | BASELINE (escada legada, sem passar pela RPC): apagar o sufixo orfana | 0 vínculos (bug) |
-- | 16 | FIX: mesma escada após a RPC, apagar o MESMO sufixo                   | >=1 vínculo      |
-- | 17 | ... e a leitura pelo caminho do app devolve as etapas restantes       | 3, nunca 0       |
-- └────────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

CREATE TABLE public._r (n int, caso text, esperado text, obtido text, passou boolean);
CREATE TABLE public._ids (k text primary key, v uuid);

INSERT INTO public._ids (k, v) VALUES
  ('u',         '00000000-0000-4000-8000-0000000000c1'),
  ('med_a',     '00000000-0000-4000-8000-0000000000a1'),
  ('med_b',     '00000000-0000-4000-8000-0000000000b1'),
  ('proto',     '00000000-0000-4000-8000-0000000000f1'),
  ('tit',       '00000000-0000-4000-8000-0000000000e1'),
  ('step0',     '00000000-0000-4000-8000-000000000001'),
  ('step1',     '00000000-0000-4000-8000-000000000002'),
  ('step2',     '00000000-0000-4000-8000-000000000003'),
  ('inst_past', '00000000-0000-4000-8000-0000000000d1'),
  ('inst_fut',  '00000000-0000-4000-8000-0000000000d2'),
  -- PO-9: duas escadas de mesma forma — uma baseline (legada), outra passando pela RPC
  ('proto_bl',  '00000000-0000-4000-8000-0000000000f2'),
  ('tit_bl',    '00000000-0000-4000-8000-0000000000e2'),
  ('proto_fx',  '00000000-0000-4000-8000-0000000000f3'),
  ('tit_fx',    '00000000-0000-4000-8000-0000000000e3'),
  ('fx_step1',  '00000000-0000-4000-8000-000000000012');

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIXTURE
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
VALUES ((SELECT v FROM public._ids WHERE k='u'), '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'slice-c-052@test.local', '', now(), now());

INSERT INTO public.medicines (id, user_id, name, type, presentation, dosage_per_pill, dosage_unit)
VALUES
  ((SELECT v FROM public._ids WHERE k='med_a'), (SELECT v FROM public._ids WHERE k='u'),
   'Mounjaro 5', 'medicamento', 'injetavel', 5, 'mg'),
  ((SELECT v FROM public._ids WHERE k='med_b'), (SELECT v FROM public._ids WHERE k='u'),
   'Mounjaro 7,5', 'medicamento', 'injetavel', 7.5, 'mg');

-- O executor: UM protocolo, apontando hoje para o medicamento da etapa vigente.
INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, intake_unit,
                              frequency, weekdays, time_schedule, start_date, active)
VALUES
  ((SELECT v FROM public._ids WHERE k='proto'), (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='med_a'), 'GLP/GIP', 5, 'mg', 'semanal',
   ARRAY['domingo'], '["08:00"]'::jsonb, '2026-06-01', true),
  ((SELECT v FROM public._ids WHERE k='proto_bl'), (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='med_a'), 'Baseline PO-9', 5, 'mg', 'semanal',
   ARRAY['domingo'], '["08:00"]'::jsonb, '2026-06-01', true),
  ((SELECT v FROM public._ids WHERE k='proto_fx'), (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='med_a'), 'Fix PO-9', 5, 'mg', 'semanal',
   ARRAY['domingo'], '["08:00"]'::jsonb, '2026-06-01', true);

INSERT INTO public.titrations (id, user_id) VALUES
  ((SELECT v FROM public._ids WHERE k='tit'),    (SELECT v FROM public._ids WHERE k='u')),
  ((SELECT v FROM public._ids WHERE k='tit_bl'), (SELECT v FROM public._ids WHERE k='u')),
  ((SELECT v FROM public._ids WHERE k='tit_fx'), (SELECT v FROM public._ids WHERE k='u'));

-- Escada principal: etapa 0 vigente (med_A 5mg) → etapa 1 pendente (med_B 7,5mg) = medicine_switch.
-- A etapa 1 nasce com protocol_id NULL — o estado legado que o FR-009 elimina.
INSERT INTO public.titration_steps
  (id, titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at, protocol_id)
VALUES
  ((SELECT v FROM public._ids WHERE k='step0'), (SELECT v FROM public._ids WHERE k='tit'),
   (SELECT v FROM public._ids WHERE k='u'), 0, (SELECT v FROM public._ids WHERE k='med_a'),
   5, 'mg', 28, 'current', now() - interval '28 days', (SELECT v FROM public._ids WHERE k='proto')),
  ((SELECT v FROM public._ids WHERE k='step1'), (SELECT v FROM public._ids WHERE k='tit'),
   (SELECT v FROM public._ids WHERE k='u'), 1, (SELECT v FROM public._ids WHERE k='med_b'),
   7.5, 'mg', 28, 'pending_confirmation', NULL, NULL),
  ((SELECT v FROM public._ids WHERE k='step2'), (SELECT v FROM public._ids WHERE k='tit'),
   (SELECT v FROM public._ids WHERE k='u'), 2, (SELECT v FROM public._ids WHERE k='med_b'),
   10, 'mg', 28, 'upcoming', NULL, NULL);

-- Ocorrências: uma PASSADA já tomada (congelada em med_A/5 pelos Slices A/B) e uma FUTURA pendente.
INSERT INTO public.dose_instances
  (id, user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status)
VALUES
  ((SELECT v FROM public._ids WHERE k='inst_past'), (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='proto'), (SELECT v FROM public._ids WHERE k='med_a'),
   now() - interval '7 days', 5, 'taken'),
  ((SELECT v FROM public._ids WHERE k='inst_fut'), (SELECT v FROM public._ids WHERE k='u'),
   (SELECT v FROM public._ids WHERE k='proto'), (SELECT v FROM public._ids WHERE k='med_a'),
   now() + interval '7 days', 5, 'pending');

-- ── PO-9: duas escadas de 6 etapas, vínculo SÓ na posição 3 (a forma literal do bug) ────────
-- `tit_bl` é a baseline: nunca passa pela RPC, prova que o bug era real.
-- `tit_fx` passa pela RPC (etapa 1 pendente), prova que o vínculo N-vezes o mata.
-- `started_at` na etapa 0 não é enfeite: o CHECK `titration_steps_current_exige_started_check`
-- (CON-032 invariante 3) recusa `status='current'` sem relógio — o estado zumbi é irrepresentável.
INSERT INTO public.titration_steps
  (titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at, protocol_id)
SELECT (SELECT v FROM public._ids WHERE k='tit_bl'), (SELECT v FROM public._ids WHERE k='u'),
       p, (SELECT v FROM public._ids WHERE k='med_a'), 2.5 + p, 'mg', 28,
       CASE p WHEN 0 THEN 'current' ELSE 'upcoming' END,
       CASE p WHEN 0 THEN now() - interval '28 days' ELSE NULL END,
       CASE p WHEN 3 THEN (SELECT v FROM public._ids WHERE k='proto_bl') ELSE NULL END
FROM generate_series(0, 5) AS p;

INSERT INTO public.titration_steps
  (id, titration_id, user_id, position, medicine_id, dose, intake_unit, duration_days, status, started_at, protocol_id)
SELECT CASE p WHEN 1 THEN (SELECT v FROM public._ids WHERE k='fx_step1') ELSE gen_random_uuid() END,
       (SELECT v FROM public._ids WHERE k='tit_fx'), (SELECT v FROM public._ids WHERE k='u'),
       p, (SELECT v FROM public._ids WHERE k='med_a'), 2.5 + p, 'mg', 28,
       CASE p WHEN 0 THEN 'current' WHEN 1 THEN 'pending_confirmation' ELSE 'upcoming' END,
       CASE p WHEN 0 THEN now() - interval '28 days' ELSE NULL END,
       CASE p WHEN 3 THEN (SELECT v FROM public._ids WHERE k='proto_fx') ELSE NULL END
FROM generate_series(0, 5) AS p;

CREATE OR REPLACE FUNCTION public._as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
END; $fn$;
GRANT EXECUTE ON FUNCTION public._as_user(uuid) TO authenticated, anon, service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- APLICA A MIGRAÇÃO DENTRO DA TRANSAÇÃO (desfeita no ROLLBACK)
--
-- ⚠️ COMO RODAR: o ambiente não tem `psql` nem `DATABASE_URL` (só REST + MCP), então não há
-- `\i` — o corpo de `20260722_titration_single_executor.sql` é COLADO aqui no momento da
-- execução, como statement único junto com o resto do arquivo. `CREATE OR REPLACE FUNCTION`
-- dentro da transação é revertido pelo ROLLBACK, então rodar isto NÃO altera prod.
--
--   >>> COLE AQUI o conteúdo de 20260722_titration_single_executor.sql <<<
--
-- Com psql disponível, trocar as duas linhas acima por: \i 20260722_titration_single_executor.sql

-- ═══════════════════════════════════════════════════════════════════════════════
-- EXECUÇÃO — medicine_switch pelo caminho REAL (a RPC, como o app a chama)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public._snap (k text primary key, n int);
INSERT INTO public._snap
SELECT 'protocols_antes', count(*)::int FROM public.protocols
 WHERE user_id = (SELECT v FROM public._ids WHERE k='u');

SELECT public._as_user((SELECT v FROM public._ids WHERE k='u'));

CREATE TABLE public._res (k text primary key, v jsonb);
INSERT INTO public._res
SELECT 'primeira', public.confirm_titration_switch((SELECT v FROM public._ids WHERE k='step1'));
INSERT INTO public._res
SELECT 'segunda',  public.confirm_titration_switch((SELECT v FROM public._ids WHERE k='step1'));
INSERT INTO public._res
SELECT 'po9_fix',  public.confirm_titration_switch((SELECT v FROM public._ids WHERE k='fx_step1'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- PO-7 — o executor é mutado, não multiplicado
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public._r
SELECT 1, 'contagem de protocols do usuário não muda na transição',
       (SELECT n FROM public._snap WHERE k='protocols_antes')::text,
       count(*)::text,
       count(*) = (SELECT n FROM public._snap WHERE k='protocols_antes')
FROM public.protocols WHERE user_id = (SELECT v FROM public._ids WHERE k='u');

INSERT INTO public._r
SELECT 2, 'executor vigente aponta para o medicamento NOVO',
       (SELECT v FROM public._ids WHERE k='med_b')::text, medicine_id::text,
       medicine_id = (SELECT v FROM public._ids WHERE k='med_b')
FROM public.protocols WHERE id = (SELECT v FROM public._ids WHERE k='proto');

INSERT INTO public._r
SELECT 3, 'executor vigente recebeu a dose da etapa nova', '7.5', dosage_per_intake::text,
       dosage_per_intake = 7.5
FROM public.protocols WHERE id = (SELECT v FROM public._ids WHERE k='proto');

INSERT INTO public._r
SELECT 4, 'nenhum protocolo recebeu end_date pela transição', '0', count(*)::text, count(*) = 0
FROM public.protocols
WHERE user_id = (SELECT v FROM public._ids WHERE k='u') AND end_date IS NOT NULL;

INSERT INTO public._r
SELECT 5, 'nenhum protocolo recebeu paused_at pela transição', '0', count(*)::text, count(*) = 0
FROM public.protocols
WHERE user_id = (SELECT v FROM public._ids WHERE k='u') AND paused_at IS NOT NULL;

INSERT INTO public._r
SELECT 6, 'retorno: protocol_activated é o executor de sempre',
       (SELECT v FROM public._ids WHERE k='proto')::text,
       v->>'protocol_activated',
       (v->>'protocol_activated')::uuid = (SELECT v FROM public._ids WHERE k='proto')
FROM public._res WHERE k='primeira';

INSERT INTO public._r
SELECT 7, 'retorno: protocol_paused é null (não há anterior para pausar)', 'null',
       COALESCE(v->>'protocol_paused', 'null'), v->>'protocol_paused' IS NULL
FROM public._res WHERE k='primeira';

INSERT INTO public._r
SELECT 8, 'idempotência: 2ª chamada devolve already_confirmed', 'true',
       COALESCE(v->>'already_confirmed', '(ausente)'), (v->>'already_confirmed') = 'true'
FROM public._res WHERE k='segunda';

INSERT INTO public._r
SELECT 9, 'idempotência: 2ª chamada não criou protocolo',
       (SELECT n FROM public._snap WHERE k='protocols_antes')::text, count(*)::text,
       count(*) = (SELECT n FROM public._snap WHERE k='protocols_antes')
FROM public.protocols WHERE user_id = (SELECT v FROM public._ids WHERE k='u');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PO-8 — o passado não é reescrito (PO-1 re-executado como guard de regressão)
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public._r
SELECT 10, 'instância PASSADA: medicine_id segue o da época',
       (SELECT v FROM public._ids WHERE k='med_a')::text, medicine_id::text,
       medicine_id = (SELECT v FROM public._ids WHERE k='med_a')
FROM public.dose_instances WHERE id = (SELECT v FROM public._ids WHERE k='inst_past');

INSERT INTO public._r
SELECT 11, 'instância PASSADA: expected_dose segue o da época', '5', expected_dose::text,
       expected_dose = 5
FROM public.dose_instances WHERE id = (SELECT v FROM public._ids WHERE k='inst_past');

INSERT INTO public._r
SELECT 12, 'instância passada NÃO virou skipped_paused (guard do PO-1)', 'taken', status,
       status = 'taken'
FROM public.dose_instances WHERE id = (SELECT v FROM public._ids WHERE k='inst_past');

INSERT INTO public._r
SELECT 13, 'instância FUTURA pending não foi pausada pela transição', 'pending', status,
       status = 'pending'
FROM public.dose_instances WHERE id = (SELECT v FROM public._ids WHERE k='inst_fut');

-- ═══════════════════════════════════════════════════════════════════════════════
-- FR-009 — toda etapa aponta para o executor único
-- ═══════════════════════════════════════════════════════════════════════════════
INSERT INTO public._r
SELECT 14, 'todas as etapas da escada apontam para o executor único', '0', count(*)::text,
       count(*) = 0
FROM public.titration_steps
WHERE titration_id = (SELECT v FROM public._ids WHERE k='tit')
  AND protocol_id IS DISTINCT FROM (SELECT v FROM public._ids WHERE k='proto');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PO-9 — apagar o sufixo editável nunca orfana a escada (repro de prod, 2026-07-20)
-- ═══════════════════════════════════════════════════════════════════════════════
-- BASELINE: escada legada que NÃO passou pela RPC. Apagar as posições >= 3 leva junto a única
-- linha que carregava o vínculo. É o bug, reproduzido — este caso passa quando o resultado é 0.
DELETE FROM public.titration_steps
WHERE titration_id = (SELECT v FROM public._ids WHERE k='tit_bl') AND position >= 3;

INSERT INTO public._r
SELECT 15, 'BASELINE (sem RPC): apagar o sufixo orfana a escada — o bug era real', '0',
       count(*)::text, count(*) = 0
FROM public.titration_steps
WHERE titration_id = (SELECT v FROM public._ids WHERE k='tit_bl') AND protocol_id IS NOT NULL;

-- FIX: mesma forma, mas a RPC já vinculou TODAS as etapas ao executor. Apagar o MESMO sufixo
-- não tem como levar "o" vínculo — não existe mais linha sorteada.
DELETE FROM public.titration_steps
WHERE titration_id = (SELECT v FROM public._ids WHERE k='tit_fx') AND position >= 3;

INSERT INTO public._r
SELECT 16, 'FIX: após a RPC, apagar o mesmo sufixo mantém a escada vinculada', '>=1',
       count(*)::text, count(*) >= 1
FROM public.titration_steps
WHERE titration_id = (SELECT v FROM public._ids WHERE k='tit_fx') AND protocol_id IS NOT NULL;

-- Leitura pelo caminho REAL do app: `getLadderForProtocol` filtra titration_steps por
-- protocol_id. Era exatamente esta query que devolvia [] e desenhava "sem escada".
INSERT INTO public._r
SELECT 17, 'leitura por protocol_id devolve as etapas restantes, nunca []', '3', count(*)::text,
       count(*) = 3
FROM public.titration_steps
WHERE user_id = (SELECT v FROM public._ids WHERE k='u')
  AND protocol_id = (SELECT v FROM public._ids WHERE k='proto_fx');

-- ═══════════════════════════════════════════════════════════════════════════════
-- Um único SELECT final: o executor MCP devolve só o último result set. A linha 999 é o placar.
SELECT n, caso, esperado, obtido, passou FROM public._r
UNION ALL
SELECT 999, 'PLACAR', count(*)::text || ' casos',
       count(*) FILTER (WHERE passou)::text || ' ok', count(*) FILTER (WHERE NOT passou) = 0
FROM public._r
ORDER BY n;

ROLLBACK;
