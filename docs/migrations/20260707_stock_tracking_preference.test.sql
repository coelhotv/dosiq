-- 20260707_stock_tracking_preference.test.sql — F1 (épico 044, T002)
--
-- Testes BEGIN..ROLLBACK das 3 RPCs atômicas (CON-026) nos 2 modos.
-- Roda contra o banco real SEM deixar rastro: tudo dentro de uma transação revertida no fim
-- (DDL da migração inclusa é transacional no Postgres — o teste aplica a migração, exercita e
-- desfaz). Executar via MCP `execute_sql` ou psql:
--
--   \i docs/migrations/20260707_stock_tracking_preference.sql   -- se já aplicada, remover
--   \i docs/migrations/20260707_stock_tracking_preference.test.sql
--
-- Cobertura (PO-1 da spec 044):
--   OFF: registrar / desfazer / atualizar / excluir → medicine_logs + dose_instances corretos,
--        ZERO mutação em stock / stock_consumptions / stock_adjustments / purchases,
--        e NENHUM erro "Estoque insuficiente" (nem com saldo 0).
--   ON : comportamento atual preservado (guard de regressão — FR-009/SC-003).
--   Failure mode: linha de user_settings AUSENTE → tratado como ON (nunca desliga por omissão).
--                 Este assert PEGOU UM BUG REAL na 1ª execução: `SELECT ... INTO v` sem linha
--                 atribui NULL (não preserva o init da variável), o que desligava o estoque por
--                 omissão. Fix: COALESCE depois do SELECT. NÃO REMOVER este assert.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fixtures (3 usuários: OFF, ON, SEM linha em user_settings)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE t_ids (k text PRIMARY KEY, v uuid);

INSERT INTO t_ids (k, v) VALUES
  ('u_off',  gen_random_uuid()),
  ('u_on',   gen_random_uuid()),
  ('u_none', gen_random_uuid()),
  ('med_off',  gen_random_uuid()),
  ('med_on',   gen_random_uuid()),
  ('med_none', gen_random_uuid()),
  ('prot_off',  gen_random_uuid()),
  ('prot_on',   gen_random_uuid()),
  ('prot_none', gen_random_uuid()),
  ('inst_off', gen_random_uuid());

INSERT INTO auth.users (id, email)
SELECT v, k || '-044@test.local' FROM t_ids WHERE k IN ('u_off','u_on','u_none');

-- Preferência: u_off = dose-only · u_on = estoque ativo · u_none = SEM LINHA (failure mode)
INSERT INTO public.user_settings (user_id, stock_tracking_enabled, stock_paused_at)
VALUES
  ((SELECT v FROM t_ids WHERE k='u_off'), false, now()),
  ((SELECT v FROM t_ids WHERE k='u_on'),  true,  NULL);

-- NB: `medicines.type` tem DEFAULT 'medicine' em prod, que VIOLA o próprio CHECK
-- (medicines_type_check aceita só 'medicamento'|'suplemento'). Por isso o INSERT é explícito.
INSERT INTO public.medicines (id, user_id, name, dosage_unit, type)
SELECT v, (SELECT v FROM t_ids WHERE k = replace(t.k,'med_','u_')), 'Med ' || t.k, 'mg', 'medicamento'
FROM t_ids t WHERE t.k LIKE 'med_%';

INSERT INTO public.protocols (id, user_id, medicine_id, name, start_date)
SELECT v,
       (SELECT v FROM t_ids WHERE k = replace(t.k,'prot_','u_')),
       (SELECT v FROM t_ids WHERE k = replace(t.k,'prot_','med_')),
       'Trat ' || t.k, CURRENT_DATE
FROM t_ids t WHERE t.k LIKE 'prot_%';

-- Estoque: só o usuário ON tem saldo. u_off e u_none ficam com saldo ZERO de propósito —
-- em modo OFF isso não pode bloquear; em u_none (tratado como ON) DEVE bloquear.
INSERT INTO public.stock (user_id, medicine_id, quantity, purchase_date)
VALUES ((SELECT v FROM t_ids WHERE k='u_on'), (SELECT v FROM t_ids WHERE k='med_on'), 10, CURRENT_DATE);

-- Instância agendada para a dose do usuário OFF (âncora + reversão do undo)
-- 052 Slice B: `medicine_id` é NOT NULL (snapshot de identidade) — toda instância nasce com ele.
INSERT INTO public.dose_instances (id, user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status)
VALUES ((SELECT v FROM t_ids WHERE k='inst_off'),
        (SELECT v FROM t_ids WHERE k='u_off'),
        (SELECT v FROM t_ids WHERE k='prot_off'),
        (SELECT v FROM t_ids WHERE k='med_off'),
        now(), 1, 'pending');

-- ─────────────────────────────────────────────────────────────────────────────
-- Asserts
-- ─────────────────────────────────────────────────────────────────────────────
DO $test$
DECLARE
  v_u_off UUID   := (SELECT v FROM t_ids WHERE k='u_off');
  v_u_on UUID    := (SELECT v FROM t_ids WHERE k='u_on');
  v_u_none UUID  := (SELECT v FROM t_ids WHERE k='u_none');
  v_med_off UUID := (SELECT v FROM t_ids WHERE k='med_off');
  v_med_on UUID  := (SELECT v FROM t_ids WHERE k='med_on');
  v_med_none UUID:= (SELECT v FROM t_ids WHERE k='med_none');
  v_prot_off UUID:= (SELECT v FROM t_ids WHERE k='prot_off');
  v_prot_on UUID := (SELECT v FROM t_ids WHERE k='prot_on');
  v_prot_none UUID := (SELECT v FROM t_ids WHERE k='prot_none');
  v_inst_off UUID := (SELECT v FROM t_ids WHERE k='inst_off');

  v_res JSONB;
  v_log_id UUID;
  v_status TEXT;
  v_qty NUMERIC;
  v_stock_rows BIGINT;
  v_consumptions BIGINT;
  v_adjustments BIGINT;
  v_purchases BIGINT;
  v_err TEXT;
  v_blocked BOOLEAN;
BEGIN
  -- Baseline das tabelas de estoque (nenhum dos caminhos OFF pode alterar isso).
  SELECT count(*) INTO v_stock_rows FROM public.stock;
  SELECT count(*) INTO v_consumptions FROM public.stock_consumptions;
  SELECT count(*) INTO v_adjustments FROM public.stock_adjustments;
  SELECT count(*) INTO v_purchases FROM public.purchases;

  -- ═══ MODO OFF (dose-only) — saldo ZERO de propósito ═════════════════════════

  -- (1) REGISTRAR: cria log, ancora instância, não toca estoque, não lança "Estoque insuficiente"
  v_res := public.register_dose_atomic(
    v_u_off, v_prot_off, v_med_off, now(), 2, 'dose-only', v_inst_off, true, NULL);
  v_log_id := (v_res->>'id')::uuid;

  IF v_log_id IS NULL THEN RAISE EXCEPTION 'FALHA OFF/register: log não criado'; END IF;
  IF (v_res->>'dose_instance_id')::uuid IS DISTINCT FROM v_inst_off THEN
    RAISE EXCEPTION 'FALHA OFF/register: instância não ancorada';
  END IF;
  SELECT status INTO v_status FROM public.dose_instances WHERE id = v_inst_off;
  IF v_status <> 'taken' THEN RAISE EXCEPTION 'FALHA OFF/register: instância = %, esperado taken', v_status; END IF;

  -- (2) ATUALIZAR: muda quantidade (stock-affecting em modo ON) → nada de estoque em OFF
  v_res := public.update_dose_log_atomic(
    v_u_off, v_log_id, NULL, v_med_off, NULL, 5, NULL, false, false, NULL, false);
  SELECT quantity_taken INTO v_qty FROM public.medicine_logs WHERE id = v_log_id;
  IF v_qty <> 5 THEN RAISE EXCEPTION 'FALHA OFF/update: quantity_taken = %, esperado 5', v_qty; END IF;

  -- (3) DESFAZER (mesma RPC do delete): remove log, reverte instância, não restaura estoque
  PERFORM public.delete_dose_log_atomic(v_u_off, v_log_id, 120);
  IF EXISTS (SELECT 1 FROM public.medicine_logs WHERE id = v_log_id) THEN
    RAISE EXCEPTION 'FALHA OFF/undo: log não removido';
  END IF;
  SELECT status INTO v_status FROM public.dose_instances WHERE id = v_inst_off;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'FALHA OFF/undo: instância = %, esperado pending', v_status; END IF;

  -- (4) EXCLUIR log avulso (sem instância)
  v_res := public.register_dose_atomic(
    v_u_off, v_prot_off, v_med_off, now(), 1, NULL, NULL, false, NULL);
  v_log_id := (v_res->>'id')::uuid;
  PERFORM public.delete_dose_log_atomic(v_u_off, v_log_id, 120);
  IF EXISTS (SELECT 1 FROM public.medicine_logs WHERE id = v_log_id) THEN
    RAISE EXCEPTION 'FALHA OFF/delete: log avulso não removido';
  END IF;

  -- (5) ZERO mutação nas tabelas de estoque em TODOS os 4 caminhos acima
  IF (SELECT count(*) FROM public.stock) <> v_stock_rows
     OR (SELECT count(*) FROM public.stock_consumptions) <> v_consumptions
     OR (SELECT count(*) FROM public.stock_adjustments) <> v_adjustments
     OR (SELECT count(*) FROM public.purchases) <> v_purchases THEN
    RAISE EXCEPTION 'FALHA OFF: camada de estoque foi mutada (stock/consumptions/adjustments/purchases)';
  END IF;
  RAISE NOTICE 'OK OFF: register/update/undo/delete sem tocar estoque, sem erro de saldo';

  -- ═══ MODO ON (guard de regressão — FR-009/SC-003) ═══════════════════════════
  -- `restore_stock_for_log` resolve o dono por `auth.uid()` (não por p_user_id), então os
  -- caminhos ON de update/delete exigem o claim setado. Sem isso a função lança
  -- 'Usuário não autenticado' — comportamento pré-existente, fora do escopo do 044 F1.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u_on)::text, true);

  v_res := public.register_dose_atomic(
    v_u_on, v_prot_on, v_med_on, now(), 3, NULL, NULL, false, NULL);
  v_log_id := (v_res->>'id')::uuid;

  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 7 THEN RAISE EXCEPTION 'FALHA ON/register: saldo = %, esperado 7 (10-3)', v_qty; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stock_consumptions WHERE medicine_log_id = v_log_id) THEN
    RAISE EXCEPTION 'FALHA ON/register: stock_consumptions não criado';
  END IF;

  -- update stock-affecting: restaura 3 e consome 4 → saldo 6
  PERFORM public.update_dose_log_atomic(
    v_u_on, v_log_id, NULL, v_med_on, NULL, 4, NULL, false, false, NULL, false);
  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 6 THEN RAISE EXCEPTION 'FALHA ON/update: saldo = %, esperado 6 (10-4)', v_qty; END IF;

  -- delete: restaura tudo → saldo 10
  PERFORM public.delete_dose_log_atomic(v_u_on, v_log_id, 120);
  SELECT COALESCE(SUM(quantity),0) INTO v_qty FROM public.stock WHERE user_id = v_u_on;
  IF v_qty <> 10 THEN RAISE EXCEPTION 'FALHA ON/delete: saldo = %, esperado 10 (restaurado)', v_qty; END IF;
  RAISE NOTICE 'OK ON: consumo/restauração FIFO preservados (10 → 7 → 6 → 10)';

  -- ON com saldo insuficiente continua bloqueando (a guarda não pode ter sumido)
  v_blocked := false;
  BEGIN
    PERFORM public.register_dose_atomic(
      v_u_on, v_prot_on, v_med_on, now(), 999, NULL, NULL, false, NULL);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    v_blocked := (v_err = 'Estoque insuficiente');
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FALHA ON: dose acima do saldo NÃO foi bloqueada'; END IF;
  RAISE NOTICE 'OK ON: "Estoque insuficiente" ainda bloqueia acima do saldo';

  -- ═══ FAILURE MODE: usuário SEM linha em user_settings → tratado como ON ═════
  v_blocked := false;
  BEGIN
    PERFORM public.register_dose_atomic(
      v_u_none, v_prot_none, v_med_none, now(), 1, NULL, NULL, false, NULL);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    v_blocked := (v_err = 'Estoque insuficiente');
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FALHA fail-safe: usuário sem user_settings NÃO foi tratado como tracking ON';
  END IF;
  RAISE NOTICE 'OK fail-safe: sem linha em user_settings → estoque permanece ATIVO (nunca desliga por omissão)';

  -- ═══ SEGURANÇA (review #735): role `anon` é BLOQUEADO explicitamente ═══════
  -- Guard do bypass de autorização: antes, um anon caía no ELSE do IF e passava.
  -- (Ortogonal ao grant — anon não tem EXECUTE nestas RPCs; isto é defesa em profundidade.)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u_on, 'role', 'anon')::text, true);
  v_blocked := false;
  BEGIN
    PERFORM public.register_dose_atomic(v_u_on, v_prot_on, v_med_on, now(), 1, NULL, NULL, false, NULL);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    v_blocked := (v_err = 'Acesso não autorizado');
  END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FALHA SEC: role anon NAO foi bloqueado'; END IF;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'OK SEC: role anon bloqueado com "Acesso não autorizado"';

  RAISE NOTICE '=== 044 F1: TODOS OS ASSERTS PASSARAM ===';
END;
$test$;

ROLLBACK;
