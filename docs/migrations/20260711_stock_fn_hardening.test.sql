-- 20260711_stock_fn_hardening.test.sql — Spec 044 F2 (T007b + T007c)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270). Não deixa rastro.
-- Rodar DEPOIS de aplicar 20260711_stock_fn_hardening.sql (ou aplicar a migração dentro
-- da mesma transação — DDL é transacional no Postgres).
--
-- Failure modes cobertos:
--   | # | Condição                                              | Esperado                                   |
--   |---|-------------------------------------------------------|--------------------------------------------|
--   | 1 | restore server-side: p_user_id explícito, SEM sessão   | restaura o estoque do dono passado         |
--   | 2 | update/delete atomic ON, SEM sessão (service_role)     | FIFO 10→7→6→10 (era 'Usuário não autenticado') |
--   | 3 | restore SEM p_user_id e SEM sessão                     | RAISE 'Usuário não autenticado'            |
--   | 4 | restore com sessão authenticated (caminho web/mobile)  | funciona (p_user_id NULL → auth.uid())     |
--   | 5 | restore com sessão authenticated de OUTRO usuário      | RAISE 'Acesso não autorizado' (IDOR)       |
--   | 6 | INSERT em medicines SEM `type` (T007c)                 | passa, e nasce 'medicamento'               |
--   | 7 | INSERT em medicines com `type` inválido                | segue REJEITADO pelo CHECK                 |
--   | 8 | modo OFF (dose-only) — guard da F1                     | delete não toca estoque                    |

BEGIN;

CREATE TEMP TABLE t_ids (k text PRIMARY KEY, v uuid);

INSERT INTO t_ids (k, v) VALUES
  ('u_on',   gen_random_uuid()),
  ('u_off',  gen_random_uuid()),
  ('u_other',gen_random_uuid()),
  ('med_on', gen_random_uuid()),
  ('med_off',gen_random_uuid()),
  ('prot_on', gen_random_uuid()),
  ('prot_off',gen_random_uuid());

INSERT INTO auth.users (id, email)
SELECT v, k || '-044f2@test.local' FROM t_ids WHERE k IN ('u_on','u_off','u_other');

INSERT INTO public.user_settings (user_id, stock_tracking_enabled)
VALUES ((SELECT v FROM t_ids WHERE k='u_on'),  true),
       ((SELECT v FROM t_ids WHERE k='u_off'), false),
       ((SELECT v FROM t_ids WHERE k='u_other'), true);

INSERT INTO public.medicines (id, user_id, name, dosage_unit, type)
VALUES ((SELECT v FROM t_ids WHERE k='med_on'),  (SELECT v FROM t_ids WHERE k='u_on'),  'Med ON',  'mg', 'medicamento'),
       ((SELECT v FROM t_ids WHERE k='med_off'), (SELECT v FROM t_ids WHERE k='u_off'), 'Med OFF', 'mg', 'medicamento');

INSERT INTO public.protocols (id, user_id, medicine_id, name, start_date)
VALUES ((SELECT v FROM t_ids WHERE k='prot_on'),  (SELECT v FROM t_ids WHERE k='u_on'),  (SELECT v FROM t_ids WHERE k='med_on'),  'Trat ON',  CURRENT_DATE),
       ((SELECT v FROM t_ids WHERE k='prot_off'), (SELECT v FROM t_ids WHERE k='u_off'), (SELECT v FROM t_ids WHERE k='med_off'), 'Trat OFF', CURRENT_DATE);

INSERT INTO public.stock (user_id, medicine_id, quantity, purchase_date)
VALUES ((SELECT v FROM t_ids WHERE k='u_on'), (SELECT v FROM t_ids WHERE k='med_on'), 10, CURRENT_DATE);

DO $test$
DECLARE
  v_u_on UUID    := (SELECT v FROM t_ids WHERE k='u_on');
  v_u_off UUID   := (SELECT v FROM t_ids WHERE k='u_off');
  v_u_other UUID := (SELECT v FROM t_ids WHERE k='u_other');
  v_med_on UUID  := (SELECT v FROM t_ids WHERE k='med_on');
  v_med_off UUID := (SELECT v FROM t_ids WHERE k='med_off');
  v_prot_on UUID := (SELECT v FROM t_ids WHERE k='prot_on');
  v_prot_off UUID:= (SELECT v FROM t_ids WHERE k='prot_off');

  v_res JSONB;
  v_log_id UUID;
  v_qty NUMERIC;
  v_type TEXT;
  v_sigs INT;
  v_stock_rows BIGINT;
  v_consumptions BIGINT;
  v_adjustments BIGINT;
  v_blocked BOOLEAN;
BEGIN
  -- ═══ (0) INTEGRIDADE ESTRUTURAL: UMA assinatura de restore_stock_for_log (AP-227) ═══
  SELECT count(*) INTO v_sigs
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='restore_stock_for_log';
  IF v_sigs <> 1 THEN
    RAISE EXCEPTION 'FALHA estrutura: % assinaturas de restore_stock_for_log (esperado 1 — overload AP-227)', v_sigs;
  END IF;

  -- ═══ (1)(2) SERVER-SIDE: sem sessão (service_role/cron). Antes: 'Usuário não autenticado'. ═══
  PERFORM set_config('request.jwt.claims', NULL, true);

  v_res := public.register_dose_atomic(v_u_on, v_prot_on, v_med_on, now(), 3, NULL, NULL, false, NULL);
  v_log_id := (v_res->>'id')::uuid;
  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 7 THEN RAISE EXCEPTION 'FALHA server/register: saldo = %, esperado 7 (10-3)', v_qty; END IF;

  -- update stock-affecting SEM sessão → restore(3) + consume(4) → 6
  PERFORM public.update_dose_log_atomic(v_u_on, v_log_id, NULL, v_med_on, NULL, 4, NULL, false, false, NULL, false);
  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 6 THEN RAISE EXCEPTION 'FALHA server/update: saldo = %, esperado 6 (10-4)', v_qty; END IF;

  -- delete SEM sessão → restore total → 10
  PERFORM public.delete_dose_log_atomic(v_u_on, v_log_id, 120);
  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 10 THEN RAISE EXCEPTION 'FALHA server/delete: saldo = %, esperado 10 (restaurado)', v_qty; END IF;
  RAISE NOTICE 'OK server-side (sem sessão): FIFO 10→7→6→10 via p_user_id explícito';

  -- ═══ (3) restore SEM p_user_id e SEM sessão → RAISE ═══
  v_res := public.register_dose_atomic(v_u_on, v_prot_on, v_med_on, now(), 2, NULL, NULL, false, NULL);
  v_log_id := (v_res->>'id')::uuid;

  v_blocked := false;
  BEGIN
    PERFORM public.restore_stock_for_log(v_log_id, 'teste_sem_dono');
  EXCEPTION WHEN OTHERS THEN
    v_blocked := (SQLERRM LIKE '%não autenticado%');
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FALHA guard: restore sem p_user_id e sem sessão DEVERIA abortar (dono indefinido)';
  END IF;

  -- ═══ (4) restore com sessão authenticated (caminho web/mobile — p_user_id NULL) ═══
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_u_on, 'role', 'authenticated')::text, true);
  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 8 THEN RAISE EXCEPTION 'FALHA pré-condição: saldo = %, esperado 8 (10-2)', v_qty; END IF;

  PERFORM public.restore_stock_for_log(v_log_id, 'dose_deleted_restore');
  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 10 THEN RAISE EXCEPTION 'FALHA client/restore: saldo = %, esperado 10', v_qty; END IF;
  RAISE NOTICE 'OK client (sessão authenticated, sem p_user_id): restore por auth.uid()';

  -- ═══ (5) IDOR: authenticated de OUTRO usuário passando p_user_id da vítima ═══
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_u_other, 'role', 'authenticated')::text, true);
  v_blocked := false;
  BEGIN
    PERFORM public.restore_stock_for_log(v_log_id, 'idor', v_u_on);
  EXCEPTION WHEN OTHERS THEN
    v_blocked := (SQLERRM LIKE '%não autorizado%');
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FALHA SEC: authenticated conseguiu restaurar estoque de terceiro (IDOR)';
  END IF;
  RAISE NOTICE 'OK SEC: p_user_id de terceiro bloqueado para authenticated';

  PERFORM set_config('request.jwt.claims', NULL, true);

  -- ═══ (8) modo OFF (guard da F1): delete não toca estoque ═══
  SELECT count(*) INTO v_stock_rows FROM public.stock;
  SELECT count(*) INTO v_consumptions FROM public.stock_consumptions;
  SELECT count(*) INTO v_adjustments FROM public.stock_adjustments;

  v_res := public.register_dose_atomic(v_u_off, v_prot_off, v_med_off, now(), 1, NULL, NULL, false, NULL);
  v_log_id := (v_res->>'id')::uuid;
  PERFORM public.update_dose_log_atomic(v_u_off, v_log_id, NULL, v_med_off, NULL, 2, NULL, false, false, NULL, false);
  PERFORM public.delete_dose_log_atomic(v_u_off, v_log_id, 120);

  IF (SELECT count(*) FROM public.stock) <> v_stock_rows
     OR (SELECT count(*) FROM public.stock_consumptions) <> v_consumptions
     OR (SELECT count(*) FROM public.stock_adjustments) <> v_adjustments THEN
    RAISE EXCEPTION 'FALHA OFF: camada de estoque foi mutada em modo dose-only';
  END IF;
  RAISE NOTICE 'OK OFF: dose-only segue sem tocar estoque (guard F1 preservado)';

  -- ═══ (6)(7) T007c — medicines.type ═══
  INSERT INTO public.medicines (user_id, name, dosage_unit)
  VALUES (v_u_on, 'Med sem type', 'mg');
  SELECT type INTO v_type FROM public.medicines WHERE user_id = v_u_on AND name = 'Med sem type';
  IF v_type <> 'medicamento' THEN
    RAISE EXCEPTION 'FALHA T007c: INSERT sem type gerou type = %, esperado medicamento', v_type;
  END IF;

  v_blocked := false;
  BEGIN
    INSERT INTO public.medicines (user_id, name, dosage_unit, type)
    VALUES (v_u_on, 'Med type inválido', 'mg', 'medicine');
  EXCEPTION WHEN check_violation THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FALHA T007c: CHECK deixou passar type inválido';
  END IF;
  RAISE NOTICE 'OK T007c: INSERT sem type nasce medicamento; CHECK segue rejeitando inválido';

  RAISE NOTICE '=== TODOS OS ASSERTS PASSARAM (044 F2 / T007b + T007c) ===';
END;
$test$;

ROLLBACK;
