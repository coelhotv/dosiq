-- 20261003_report_dose_days.test.sql — spec 097 Slice A1 (PO-6, PO-SEC-2)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270/R-288: sem mock do primitivo). Auto-contido: PARTE 0
-- é cópia literal de 20261003_report_dose_days.sql. `_try(sql)` devolve 'ok:<linhas>' ou
-- 'err:<sqlstate>'.
--
-- Via MCP execute_sql: sem BEGIN; a string inteira é uma transação implícita e o bloco final
-- RAISE EXCEPTION 'RESULT …' desfaz tudo (variante gerada no C3; o arquivo usa BEGIN/ROLLBACK).
--
-- Fixture (A em America/Sao_Paulo, janela 2026-09-10..2026-09-12):
--   p1: 10/09 08:00 taken · 10/09 20:00 missed · 10/09 23:30 taken (02:30 UTC do dia 11)
--       11/09 08:00 skipped_paused · 09/09 23:30 taken (fora) · 13/09 00:30 taken (fora)
--   p2 (arquivado): 11/09 08:00 skipped_user · 12/09 08:00 pending
--   B: 10/09 08:00 taken · C (sem user_settings): 10/09 23:30 taken
--
-- ┌─ Casos ────────────────────────────────────────────────────────────────┐
-- |  1-9  | contagens por tratamento × dia local × horário            | PO-6     |
-- | 10-12 | B não vê A; C sem user_settings usa SP                    | PO-SEC-2 |
-- | 13-17 | janela NULL/invertida/longa/vazia; anon 42501             | R-270    |
-- | 18-22 | metadados: INVOKER, search_path, grants, FK do user_id    | PO-SEC-2 |
-- └────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 0 — a migração sob teste (idêntica ao arquivo .sql)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.report_dose_days(p_from date, p_to date)
RETURNS TABLE (
  protocol_id    uuid,
  medicine_id    uuid,
  day            date,
  slot           text,
  taken_count    integer,
  missed_count   integer,
  paused_count   integer,
  skipped_count  integer,
  pending_count  integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_tz  text;
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'report_dose_days: período obrigatório' USING ERRCODE = '22004';
  END IF;
  IF p_from > p_to THEN
    RAISE EXCEPTION 'report_dose_days: início depois do fim' USING ERRCODE = '22023';
  END IF;
  IF p_to - p_from > 186 THEN
    RAISE EXCEPTION 'report_dose_days: período acima de 186 dias' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(us.timezone, 'America/Sao_Paulo') INTO v_tz
    FROM public.user_settings us WHERE us.user_id = v_uid;
  v_tz := COALESCE(v_tz, 'America/Sao_Paulo');

  RETURN QUERY
  WITH inst AS (
    SELECT di.protocol_id,
           di.medicine_id,
           (di.scheduled_for AT TIME ZONE v_tz)::date        AS day,
           to_char(di.scheduled_for AT TIME ZONE v_tz, 'HH24:MI') AS slot,
           di.status
      FROM public.dose_instances di
     WHERE di.user_id = v_uid
       -- janela em instantes (usa o índice de scheduled_for), recortada de novo pelo dia local
       AND di.scheduled_for >= (p_from::timestamp AT TIME ZONE v_tz) - interval '1 day'
       AND di.scheduled_for <  ((p_to + 1)::timestamp AT TIME ZONE v_tz) + interval '1 day'
  )
  SELECT i.protocol_id,
         i.medicine_id,
         i.day,
         i.slot,
         count(*) FILTER (WHERE i.status = 'taken')::integer,
         count(*) FILTER (WHERE i.status = 'missed')::integer,
         count(*) FILTER (WHERE i.status = 'skipped_paused')::integer,
         count(*) FILTER (WHERE i.status = 'skipped_user')::integer,
         count(*) FILTER (WHERE i.status = 'pending')::integer
    FROM inst i
   WHERE i.day BETWEEN p_from AND p_to
   GROUP BY i.protocol_id, i.medicine_id, i.day, i.slot
   ORDER BY i.day, i.slot, i.protocol_id;
END;
$$;

COMMENT ON FUNCTION public.report_dose_days(date, date) IS
  'Spec 097/ADR-105: contagens de dose_instances do chamador por tratamento × dia local × horário (fuso de user_settings). Sem percentual: adesão é do core (ADR-054).';

REVOKE EXECUTE ON FUNCTION public.report_dose_days(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_dose_days(date, date) FROM anon;
GRANT  EXECUTE ON FUNCTION public.report_dose_days(date, date) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.report_dose_days(date, date) TO service_role;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — fixtures (como postgres, depois da migração)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public._r (n int, caso text, esperado text, obtido text, ok boolean);
CREATE TABLE public._ids (k text PRIMARY KEY, v uuid);
GRANT ALL ON public._r, public._ids TO authenticated, anon, service_role;
INSERT INTO public._ids (k, v) SELECT k, gen_random_uuid() FROM unnest(ARRAY[
  'u_a','u_b','u_c','med_a','med_b','med_c','p1','p2','pb','pc']) k;

CREATE FUNCTION public._id(p text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT v FROM public._ids WHERE k = p $$;
CREATE FUNCTION public._as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_uid IS NULL THEN json_build_object('role','anon')::text
         ELSE json_build_object('sub', p_uid::text, 'role', 'authenticated')::text END, true);
END; $fn$;
CREATE FUNCTION public._try(p_sql text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_n int;
BEGIN
  EXECUTE p_sql; GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN 'ok:' || v_n;
EXCEPTION WHEN OTHERS THEN RETURN 'err:' || SQLSTATE;
END; $fn$;
-- Executa como o papel corrente e devolve o 1º valor (ou 'err:<sqlstate>').
CREATE FUNCTION public._val(p_sql text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v text;
BEGIN
  EXECUTE p_sql INTO v; RETURN coalesce(v, 'null');
EXCEPTION WHEN OTHERS THEN RETURN 'err:' || SQLSTATE;
END; $fn$;
CREATE FUNCTION public._chk(p_n int, p_caso text, p_esperado text, p_obtido text) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO public._r VALUES (p_n, p_caso, p_esperado, p_obtido, p_obtido = p_esperado) $$;
GRANT EXECUTE ON FUNCTION public._id(text), public._as(uuid), public._try(text), public._val(text),
  public._chk(int, text, text, text) TO authenticated, anon, service_role;

INSERT INTO auth.users (id, email)
SELECT v, k || '-097@test.local' FROM public._ids WHERE k IN ('u_a','u_b','u_c');   -- trigger cria user_settings
UPDATE public.user_settings SET timezone = 'America/Sao_Paulo' WHERE user_id = public._id('u_a');
UPDATE public.user_settings SET timezone = 'America/Sao_Paulo' WHERE user_id = public._id('u_b');
DELETE FROM public.user_settings WHERE user_id = public._id('u_c');

INSERT INTO public.medicines (id, user_id, name, dosage_unit, type, presentation)
SELECT public._id('med_' || s), public._id('u_' || s), 'm' || s, 'mg', 'medicamento', 'comprimido'
FROM unnest(ARRAY['a','b','c']) s;
INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, frequency, time_schedule, start_date, active)
VALUES (public._id('p1'), public._id('u_a'), public._id('med_a'), 'p1', 1, 'diário', '["08:00","20:00"]', '2026-09-01', true),
       (public._id('p2'), public._id('u_a'), public._id('med_a'), 'p2', 1, 'diário', '["08:00"]', '2026-09-01', false),
       (public._id('pb'), public._id('u_b'), public._id('med_b'), 'pb', 1, 'diário', '["08:00"]', '2026-09-01', true),
       (public._id('pc'), public._id('u_c'), public._id('med_c'), 'pc', 1, 'diário', '["23:30"]', '2026-09-01', true);
UPDATE public.protocols SET archived_at = '2026-09-12 12:00-03' WHERE id = public._id('p2');

INSERT INTO public.dose_instances (user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status)
VALUES
  (public._id('u_a'), public._id('p1'), public._id('med_a'), '2026-09-10 08:00-03', 1, 'taken'),
  (public._id('u_a'), public._id('p1'), public._id('med_a'), '2026-09-10 20:00-03', 1, 'missed'),
  (public._id('u_a'), public._id('p1'), public._id('med_a'), '2026-09-10 23:30-03', 1, 'taken'),
  (public._id('u_a'), public._id('p1'), public._id('med_a'), '2026-09-11 08:00-03', 1, 'skipped_paused'),
  (public._id('u_a'), public._id('p1'), public._id('med_a'), '2026-09-09 23:30-03', 1, 'taken'),
  (public._id('u_a'), public._id('p1'), public._id('med_a'), '2026-09-13 00:30-03', 1, 'taken'),
  (public._id('u_a'), public._id('p2'), public._id('med_a'), '2026-09-11 08:00-03', 1, 'skipped_user'),
  (public._id('u_a'), public._id('p2'), public._id('med_a'), '2026-09-12 08:00-03', 1, 'pending'),
  (public._id('u_b'), public._id('pb'), public._id('med_b'), '2026-09-10 08:00-03', 1, 'taken'),
  (public._id('u_c'), public._id('pc'), public._id('med_c'), '2026-09-10 23:30-03', 1, 'taken');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — dono A (PO-6)
-- ═══════════════════════════════════════════════════════════════════════════════
SET LOCAL ROLE authenticated;
SELECT public._as(public._id('u_a'));
SELECT public._chk(1, 'A: 6 grupos tratamento×dia×horário na janela', 'ok:6',
  public._try($q$SELECT * FROM public.report_dose_days('2026-09-10','2026-09-12')$q$));
SELECT public._chk(2, '23h30 -03 fica no dia local 10/09 (não 11)', '1',
  public._val(format($q$SELECT taken_count FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE protocol_id=%L AND day='2026-09-10' AND slot='23:30'$q$, public._id('p1'))));
SELECT public._chk(3, '08:00 de 10/09: 1 tomada', '1',
  public._val(format($q$SELECT taken_count FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE protocol_id=%L AND day='2026-09-10' AND slot='08:00'$q$, public._id('p1'))));
SELECT public._chk(4, '20:00 de 10/09: 1 perdida', '1',
  public._val(format($q$SELECT missed_count FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE protocol_id=%L AND slot='20:00'$q$, public._id('p1'))));
SELECT public._chk(5, 'pausa conta como pausa (US1-AC3)', '1',
  public._val(format($q$SELECT paused_count FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE protocol_id=%L AND day='2026-09-11'$q$, public._id('p1'))));
SELECT public._chk(6, 'skipped_user à parte, tratamento arquivado entra', '1',
  public._val(format($q$SELECT skipped_count FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE protocol_id=%L AND day='2026-09-11'$q$, public._id('p2'))));
SELECT public._chk(7, 'pending à parte', '1',
  public._val(format($q$SELECT pending_count FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE protocol_id=%L AND day='2026-09-12'$q$, public._id('p2'))));
SELECT public._chk(8, 'totais A: tomadas=2 perdidas=1', '2|1',
  public._val($q$SELECT sum(taken_count)||'|'||sum(missed_count) FROM public.report_dose_days('2026-09-10','2026-09-12')$q$));
SELECT public._chk(9, 'bordas 09/09 23h30 e 13/09 00h30 fora', '0',
  public._val($q$SELECT count(*) FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE day NOT BETWEEN '2026-09-10' AND '2026-09-12'$q$));

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — isolamento (PO-SEC-2) e fuso padrão
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as(public._id('u_b'));
SELECT public._chk(10, 'B: só a própria linha', 'ok:1',
  public._try($q$SELECT * FROM public.report_dose_days('2026-09-10','2026-09-12')$q$));
SELECT public._chk(11, 'B: zero linhas de A', '0',
  public._val(format($q$SELECT count(*) FROM public.report_dose_days('2026-09-10','2026-09-12') WHERE protocol_id IN (%L,%L)$q$, public._id('p1'), public._id('p2'))));
SELECT public._as(public._id('u_c'));
SELECT public._chk(12, 'C sem user_settings: fuso SP (23h30 em 10/09)', '2026-09-10',
  public._val($q$SELECT day::text FROM public.report_dose_days('2026-09-10','2026-09-12')$q$));

SELECT public._as(public._id('u_a'));
SELECT public._chk(13, 'p_from NULL → 22004', 'err:22004',
  public._try($q$SELECT * FROM public.report_dose_days(NULL,'2026-09-12')$q$));
SELECT public._chk(14, 'início depois do fim → 22023', 'err:22023',
  public._try($q$SELECT * FROM public.report_dose_days('2026-09-12','2026-09-10')$q$));
SELECT public._chk(15, 'janela de 187 dias → 22023', 'err:22023',
  public._try($q$SELECT * FROM public.report_dose_days('2026-01-01','2026-07-07')$q$));
SELECT public._chk(16, 'janela de 180 dias (máx. do produto) passa', 'ok:8',
  public._try($q$SELECT * FROM public.report_dose_days('2026-03-20','2026-09-16')$q$));
SELECT public._chk(17, 'janela sem dose → 0 linhas', 'ok:0',
  public._try($q$SELECT * FROM public.report_dose_days('2025-01-01','2025-01-31')$q$));

RESET ROLE;
SET LOCAL ROLE anon;
SELECT public._as(NULL);
SELECT public._chk(18, 'anon → 42501', 'err:42501',
  public._try($q$SELECT * FROM public.report_dose_days('2026-09-10','2026-09-12')$q$));
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — metadados (PO-SEC-2 d)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._chk(19, 'SECURITY INVOKER', 'false',
  (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.report_dose_days(date,date)'::regprocedure));
SELECT public._chk(20, 'search_path vazio', 'search_path=""',
  (SELECT array_to_string(proconfig, ',') FROM pg_proc WHERE oid = 'public.report_dose_days(date,date)'::regprocedure));
SELECT public._chk(21, 'EXECUTE: authenticated sim · anon não · PUBLIC não', 'true|false|false',
  has_function_privilege('authenticated', 'public.report_dose_days(date,date)', 'EXECUTE')::text || '|' ||
  has_function_privilege('anon', 'public.report_dose_days(date,date)', 'EXECUTE')::text || '|' ||
  (SELECT count(*) > 0 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid='public.report_dose_days(date,date)'::regprocedure)) a WHERE a.grantee = 0)::text);
SELECT public._chk(22, 'sem parâmetro de usuário/fuso (2 args date)', '2|p_from,p_to',
  (SELECT pronargs::text || '|' || array_to_string(proargnames[1:2], ',') FROM pg_proc WHERE oid = 'public.report_dose_days(date,date)'::regprocedure));
SELECT public._chk(23, 'linha do piloto impossível: FK user_id → auth.users', '1',
  (SELECT count(*)::text FROM pg_constraint WHERE conrelid='public.dose_instances'::regclass
     AND contype='f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (user_id) REFERENCES auth.users%'));

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULTADO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT n, CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS r, caso, esperado, obtido
FROM public._r ORDER BY n;

ROLLBACK;
