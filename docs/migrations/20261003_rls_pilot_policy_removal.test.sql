-- 20261003_rls_pilot_policy_removal.test.sql — spec 098 (PO-1, PO-3, PO-4 banco, PO-5, PO-SEC-1/2/3)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270/R-288: sem mock do primitivo). Auto-contido: aplica a
-- migração DENTRO da transação (DDL é transacional) e exercita cada tabela × comando como
-- dono (A), intruso (B), anon e service_role. PARTE 0 é cópia literal de
-- 20261003_rls_pilot_policy_removal.sql. `_try(sql)` devolve 'ok:<linhas>' ou 'err:<sqlstate>'.
--
-- Via MCP execute_sql: sem BEGIN; a string inteira é uma transação implícita e o bloco final
-- RAISE EXCEPTION 'RESULT …' desfaz tudo (variante gerada no C3; o arquivo usa BEGIN/ROLLBACK).
--
-- ┌─ Casos ─────────────────────────────────────────────────────────────────────────┐
-- |   1-23 | dono A: lê/cria/altera nas 5 tabelas de CRUD; não troca dono;     | PO-1      |
-- |        | não lê/altera/cria linha do piloto                                 | US1-AC1   |
-- |  30-50 | intruso B: não lê/cria/altera/apaga nada de A nem do piloto        | PO-1      |
-- |  60-65 | anon: não lê, não cria, não altera                                 | PO-1      |
-- |  70-76 | dono A apaga (medicines/protocols arquivam — trigger da 094)       | PO-1      |
-- |  80-89 | notification_log só leitura; user_settings sem DELETE              | E2 / C-2  |
-- |  90-99 | bot_sessions: cliente barrado (42501), service_role funciona       | PO-5/SEC-1|
-- | 100-108| funções, grants, políticas finais, linha do piloto                 | PO-3/4/SEC-2/3 |
-- |   109  | migração reaplicada é barrada                                      | negativo  |
-- └─────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 0 — a migração sob teste (idêntica ao arquivo .sql)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261003_rls_pilot_policy_removal.sql — spec 098 · ADR-091 (S-13) · AP-275 · AP-278
-- Remove o resto do piloto: cada conta só acessa as próprias linhas.
--
-- PROBLEMA (verificado em prod via MCP 2026-10-03):
--   32 políticas `Pilot_*` em 8 tabelas (roles=public) com
--   `user_id = '00000000-0000-0000-0000-000000000001' OR auth.uid() = user_id`:
--   qualquer conta — e o anon — lia, criava, alterava e apagava linhas em nome do piloto (que não
--   existe em auth.users). Em 6 tabelas a piloto era a ÚNICA política do dono. `bot_sessions` tinha
--   ainda `Service role can manage sessions` (ALL, roles=public, USING true): aberta a qualquer um,
--   inclusive para plantar sessão no chat_id de outra pessoa. `migrate_pilot_data()` (DEFINER)
--   executável por PUBLIC/authenticated transferia as linhas do piloto ao chamador e apagava o
--   user_settings dele. 3 outras DEFINER executáveis por PUBLIC/anon.
--
-- FIX (uma transação — apply_migration é atômico; INV-1):
--   cria as políticas do dono que faltam → fecha bot_sessions para o cliente → apaga as 32 Pilot_*
--   → apaga a linha órfã → apaga migrate_pilot_data → revoga EXECUTE indevido. Pré e pós-checagens
--   abortam tudo se o banco não estiver como medido.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                                     |
-- |----------------------------------------|---------------------------------------------------------|
-- | UPDATE do dono troca user_id           | WITH CHECK = USING em UPDATE (INV-2).                   |
-- | anon (auth.uid() NULL)                 | políticas novas só TO authenticated.                    |
-- | Pilot_* ≠ 32 ao aplicar                | pré-checagem RAISE.                                     |
-- | Linha órfã ganhou dependente           | pré-checagem conta stock_consumptions/dose_instances.   |
-- | Linha do piloto ≠ 1                    | DELETE confere ROW_COUNT = 1, senão RAISE.              |
-- | anon mantém EXECUTE via default priv.  | REVOKE nomeando anon/authenticated (AP-275, ADR-091).   |
-- | Revogar authenticated das 2 usadas     | create_purchase_with_stock / generate_telegram_token só |
-- |                                        | perdem PUBLIC e anon.                                    |
-- | Bot sem bot_sessions                   | service_role ignora RLS e mantém seus grants.           |
-- | Tabela × comando fica sem política     | tudo na mesma transação; pós-checagem da lista fechada. |
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 0. Pré-checagem ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_pilot constant uuid := '00000000-0000-0000-0000-000000000001';
  v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND policyname LIKE 'Pilot\_%';
  IF v_n <> 32 THEN RAISE EXCEPTION '098 pré: esperava 32 políticas Pilot_*, achou %', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.medicine_logs WHERE user_id = v_pilot;
  IF v_n <> 1 THEN RAISE EXCEPTION '098 pré: esperava 1 linha do piloto em medicine_logs, achou %', v_n; END IF;

  SELECT (SELECT count(*) FROM public.stock_consumptions sc
            JOIN public.medicine_logs l ON l.id = sc.medicine_log_id WHERE l.user_id = v_pilot)
       + (SELECT count(*) FROM public.dose_instances d
            JOIN public.medicine_logs l ON l.id = d.medicine_log_id WHERE l.user_id = v_pilot)
    INTO v_n;
  IF v_n <> 0 THEN RAISE EXCEPTION '098 pré: linha do piloto tem % dependentes', v_n; END IF;
END $$;

-- ─── 1. Políticas do dono (FR-001/FR-002, INV-2) ───────────────────────────────
CREATE POLICY medicines_owner_select ON public.medicines
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY medicines_owner_insert ON public.medicines
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY medicines_owner_update ON public.medicines
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY medicines_owner_delete ON public.medicines
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY protocols_owner_select ON public.protocols
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY protocols_owner_insert ON public.protocols
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY protocols_owner_update ON public.protocols
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY protocols_owner_delete ON public.protocols
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY treatment_plans_owner_select ON public.treatment_plans
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY treatment_plans_owner_insert ON public.treatment_plans
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY treatment_plans_owner_update ON public.treatment_plans
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY treatment_plans_owner_delete ON public.treatment_plans
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

CREATE POLICY medicine_logs_owner_select ON public.medicine_logs
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY medicine_logs_owner_insert ON public.medicine_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY medicine_logs_owner_update ON public.medicine_logs
  FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY medicine_logs_owner_delete ON public.medicine_logs
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- Cliente só lê (RC3/E2). Escrita é do servidor (service_role).
CREATE POLICY notification_log_owner_select ON public.notification_log
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- stock e user_settings: políticas do dono já existem. user_settings fica SEM DELETE do dono:
-- nenhum cliente apaga; a exclusão de conta é DEFINER (analysis-A C-2).

-- ─── 2. bot_sessions só do servidor (FR-002b, RC3/E1, analysis-A C-1) ──────────
DROP POLICY "Service role can manage sessions" ON public.bot_sessions;
REVOKE ALL ON public.bot_sessions FROM anon, authenticated;

-- ─── 3. Políticas do piloto ────────────────────────────────────────────────────
DROP POLICY "Pilot_Select_bot_sessions"     ON public.bot_sessions;
DROP POLICY "Pilot_Insert_bot_sessions"     ON public.bot_sessions;
DROP POLICY "Pilot_Update_bot_sessions"     ON public.bot_sessions;
DROP POLICY "Pilot_Delete_bot_sessions"     ON public.bot_sessions;
DROP POLICY "Pilot_Select_medicine_logs"    ON public.medicine_logs;
DROP POLICY "Pilot_Insert_medicine_logs"    ON public.medicine_logs;
DROP POLICY "Pilot_Update_medicine_logs"    ON public.medicine_logs;
DROP POLICY "Pilot_Delete_medicine_logs"    ON public.medicine_logs;
DROP POLICY "Pilot_Select_medicines"        ON public.medicines;
DROP POLICY "Pilot_Insert_medicines"        ON public.medicines;
DROP POLICY "Pilot_Update_medicines"        ON public.medicines;
DROP POLICY "Pilot_Delete_medicines"        ON public.medicines;
DROP POLICY "Pilot_Select_notification_log" ON public.notification_log;
DROP POLICY "Pilot_Insert_notification_log" ON public.notification_log;
DROP POLICY "Pilot_Update_notification_log" ON public.notification_log;
DROP POLICY "Pilot_Delete_notification_log" ON public.notification_log;
DROP POLICY "Pilot_Select_protocols"        ON public.protocols;
DROP POLICY "Pilot_Insert_protocols"        ON public.protocols;
DROP POLICY "Pilot_Update_protocols"        ON public.protocols;
DROP POLICY "Pilot_Delete_protocols"        ON public.protocols;
DROP POLICY "Pilot_Select_stock"            ON public.stock;
DROP POLICY "Pilot_Insert_stock"            ON public.stock;
DROP POLICY "Pilot_Update_stock"            ON public.stock;
DROP POLICY "Pilot_Delete_stock"            ON public.stock;
DROP POLICY "Pilot_Select_treatment_plans"  ON public.treatment_plans;
DROP POLICY "Pilot_Insert_treatment_plans"  ON public.treatment_plans;
DROP POLICY "Pilot_Update_treatment_plans"  ON public.treatment_plans;
DROP POLICY "Pilot_Delete_treatment_plans"  ON public.treatment_plans;
DROP POLICY "Pilot_Select_user_settings"    ON public.user_settings;
DROP POLICY "Pilot_Insert_user_settings"    ON public.user_settings;
DROP POLICY "Pilot_Update_user_settings"    ON public.user_settings;
DROP POLICY "Pilot_Delete_user_settings"    ON public.user_settings;

-- ─── 4. Linha órfã do piloto (FR-003, INV-3) ───────────────────────────────────
DO $$
DECLARE v_n int;
BEGIN
  DELETE FROM public.medicine_logs WHERE user_id = '00000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION '098: esperava apagar 1 linha do piloto, apagou %', v_n; END IF;
  RAISE NOTICE '098: linhas do piloto apagadas em medicine_logs: % (antes 1, depois 0)', v_n;
END $$;

-- ─── 5. RPC do piloto (FR-004) ─────────────────────────────────────────────────
DROP FUNCTION public.migrate_pilot_data();

-- ─── 6. EXECUTE indevido em DEFINER (FR-007, RC-SEC S2/S3) ─────────────────────
REVOKE EXECUTE ON FUNCTION public.batch_update_review_status(uuid[], text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_purchase_with_stock(uuid, numeric, numeric, date, date, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_telegram_token() FROM PUBLIC, anon;

-- ─── 7. Pós-checagem (INV-1, PO-SEC-2) ─────────────────────────────────────────
DO $$
DECLARE
  v_expected text[] := ARRAY[
    'medicine_logs|DELETE|1', 'medicine_logs|INSERT|1', 'medicine_logs|SELECT|1', 'medicine_logs|UPDATE|1',
    'medicines|DELETE|1', 'medicines|INSERT|1', 'medicines|SELECT|1', 'medicines|UPDATE|1',
    'notification_log|SELECT|1',
    'protocols|DELETE|1', 'protocols|INSERT|1', 'protocols|SELECT|1', 'protocols|UPDATE|1',
    'stock|DELETE|1', 'stock|INSERT|1', 'stock|SELECT|1', 'stock|UPDATE|1',
    'treatment_plans|DELETE|1', 'treatment_plans|INSERT|1', 'treatment_plans|SELECT|1', 'treatment_plans|UPDATE|1',
    'user_settings|INSERT|1', 'user_settings|SELECT|1', 'user_settings|UPDATE|1'];
  v_actual text[];
  v_n int;
BEGIN
  SELECT coalesce(array_agg(t ORDER BY t), '{}') INTO v_actual FROM (
    SELECT tablename || '|' || cmd || '|' || count(*) AS t FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('bot_sessions','medicine_logs','medicines','notification_log',
                         'protocols','stock','treatment_plans','user_settings')
     GROUP BY tablename, cmd) s;
  IF v_actual <> v_expected THEN
    RAISE EXCEPTION '098 pós: políticas divergem da lista fechada: %', v_actual;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND (policyname LIKE 'Pilot\_%' OR qual = 'true' AND tablename = 'bot_sessions'
          OR coalesce(qual, '') LIKE '%00000000-0000-0000-0000-000000000001%'
          OR coalesce(with_check, '') LIKE '%00000000-0000-0000-0000-000000000001%');
  IF v_n <> 0 THEN RAISE EXCEPTION '098 pós: % políticas do piloto/abertas restantes', v_n; END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — fixtures (como postgres, depois da migração)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public._r (n int, caso text, esperado text, obtido text, ok boolean);
CREATE TABLE public._ids (k text PRIMARY KEY, v uuid);
GRANT ALL ON public._r, public._ids TO authenticated, anon, service_role;
INSERT INTO public._ids (k, v) SELECT k, gen_random_uuid() FROM unnest(ARRAY[
  'u_a','u_b','med_a','med_del','p_a','p_del','tp_a','log_a','st_a','nl_a','pilot_log']) k;

CREATE FUNCTION public._id(p text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS
  $$ SELECT v FROM public._ids WHERE k = p $$;
CREATE FUNCTION public._as(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    CASE WHEN p_uid IS NULL THEN json_build_object('role','anon')::text
         ELSE json_build_object('sub', p_uid::text, 'role', 'authenticated')::text END, true);
END; $fn$;
-- Executa como o papel corrente (INVOKER) e devolve 'ok:<linhas>' ou 'err:<sqlstate>'.
CREATE FUNCTION public._try(p_sql text) RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE v_n int;
BEGIN
  EXECUTE p_sql; GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN 'ok:' || v_n;
EXCEPTION WHEN OTHERS THEN RETURN 'err:' || SQLSTATE;
END; $fn$;
CREATE FUNCTION public._chk(p_n int, p_caso text, p_esperado text, p_obtido text) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO public._r VALUES (p_n, p_caso, p_esperado, p_obtido, p_obtido = p_esperado) $$;
GRANT EXECUTE ON FUNCTION public._id(text), public._as(uuid), public._try(text),
  public._chk(int, text, text, text) TO authenticated, anon, service_role;

INSERT INTO auth.users (id, email)
SELECT v, k || '-098@test.local' FROM public._ids WHERE k IN ('u_a','u_b');   -- trigger cria user_settings

INSERT INTO public.medicines (id, user_id, name, dosage_unit, type, presentation)
SELECT public._id(k), public._id('u_a'), k, 'mg', 'medicamento', 'comprimido'
FROM unnest(ARRAY['med_a','med_del']) k;
INSERT INTO public.treatment_plans (id, user_id, name) VALUES (public._id('tp_a'), public._id('u_a'), 'tp_a');
INSERT INTO public.protocols (id, user_id, medicine_id, name, dosage_per_intake, frequency, time_schedule, start_date, active)
SELECT public._id(k), public._id('u_a'), public._id('med_a'), k, 1, 'diário', '["08:00"]'::jsonb, current_date, true
FROM unnest(ARRAY['p_a','p_del']) k;
INSERT INTO public.medicine_logs (id, user_id, medicine_id, quantity_taken)
VALUES (public._id('log_a'), public._id('u_a'), public._id('med_a'), 1),
       (public._id('pilot_log'), '00000000-0000-0000-0000-000000000001', public._id('med_a'), 1);
INSERT INTO public.stock (id, user_id, medicine_id, quantity) VALUES (public._id('st_a'), public._id('u_a'), public._id('med_a'), 10);
INSERT INTO public.notification_log (id, user_id, notification_type) VALUES (public._id('nl_a'), public._id('u_a'), 'teste_098');
INSERT INTO public.bot_sessions (user_id, chat_id, context, expires_at)
VALUES (public._id('u_a'), 98001, '{"step":"real"}', now() + interval '1 hour');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — matriz das 5 tabelas com CRUD do dono (PO-1)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Dono A
SELECT public._as(public._id('u_a'));
SET LOCAL ROLE authenticated;
SELECT public._chk(1,  'A lê medicines próprio',        'ok:1', public._try(format('SELECT 1 FROM public.medicines WHERE id=%L', public._id('med_a'))));
SELECT public._chk(2,  'A lê protocols próprio',        'ok:1', public._try(format('SELECT 1 FROM public.protocols WHERE id=%L', public._id('p_a'))));
SELECT public._chk(3,  'A lê treatment_plans próprio',  'ok:1', public._try(format('SELECT 1 FROM public.treatment_plans WHERE id=%L', public._id('tp_a'))));
SELECT public._chk(4,  'A lê medicine_logs próprio',    'ok:1', public._try(format('SELECT 1 FROM public.medicine_logs WHERE id=%L', public._id('log_a'))));
SELECT public._chk(5,  'A lê stock próprio',            'ok:1', public._try(format('SELECT 1 FROM public.stock WHERE id=%L', public._id('st_a'))));
SELECT public._chk(6,  'A cria medicines',              'ok:1', public._try(format($q$INSERT INTO public.medicines (user_id,name,dosage_unit,type,presentation) VALUES (%L,'x','mg','medicamento','comprimido')$q$, public._id('u_a'))));
SELECT public._chk(7,  'A cria treatment_plans',        'ok:1', public._try(format($q$INSERT INTO public.treatment_plans (user_id,name) VALUES (%L,'x')$q$, public._id('u_a'))));
SELECT public._chk(8,  'A cria protocols',              'ok:1', public._try(format($q$INSERT INTO public.protocols (user_id,medicine_id,name,dosage_per_intake,frequency,time_schedule,start_date) VALUES (%L,%L,'x',1,'diário','["08:00"]',current_date)$q$, public._id('u_a'), public._id('med_a'))));
SELECT public._chk(9,  'A cria medicine_logs',          'ok:1', public._try(format($q$INSERT INTO public.medicine_logs (user_id,medicine_id,quantity_taken) VALUES (%L,%L,1)$q$, public._id('u_a'), public._id('med_a'))));
SELECT public._chk(10, 'A cria stock',                  'ok:1', public._try(format($q$INSERT INTO public.stock (user_id,medicine_id,quantity) VALUES (%L,%L,5)$q$, public._id('u_a'), public._id('med_a'))));
SELECT public._chk(11, 'A altera medicines',            'ok:1', public._try(format($q$UPDATE public.medicines SET name='y' WHERE id=%L$q$, public._id('med_a'))));
SELECT public._chk(12, 'A altera protocols',            'ok:1', public._try(format($q$UPDATE public.protocols SET name='y' WHERE id=%L$q$, public._id('p_a'))));
SELECT public._chk(13, 'A altera treatment_plans',      'ok:1', public._try(format($q$UPDATE public.treatment_plans SET name='y' WHERE id=%L$q$, public._id('tp_a'))));
SELECT public._chk(14, 'A altera medicine_logs',        'ok:1', public._try(format($q$UPDATE public.medicine_logs SET quantity_taken=2 WHERE id=%L$q$, public._id('log_a'))));
SELECT public._chk(15, 'A altera stock',                'ok:1', public._try(format($q$UPDATE public.stock SET quantity=9 WHERE id=%L$q$, public._id('st_a'))));
-- WITH CHECK: dono não passa a linha para outra conta
SELECT public._chk(16, 'A não troca dono de medicines',     'err:42501', public._try(format($q$UPDATE public.medicines SET user_id=%L WHERE id=%L$q$, public._id('u_b'), public._id('med_a'))));
SELECT public._chk(17, 'A não troca dono de protocols',     'err:42501', public._try(format($q$UPDATE public.protocols SET user_id=%L WHERE id=%L$q$, public._id('u_b'), public._id('p_a'))));
SELECT public._chk(18, 'A não troca dono de treatment_plans','err:42501', public._try(format($q$UPDATE public.treatment_plans SET user_id=%L WHERE id=%L$q$, public._id('u_b'), public._id('tp_a'))));
SELECT public._chk(19, 'A não troca dono de medicine_logs', 'err:42501', public._try(format($q$UPDATE public.medicine_logs SET user_id=%L WHERE id=%L$q$, public._id('u_b'), public._id('log_a'))));
SELECT public._chk(20, 'A não troca dono de stock',         'err:42501', public._try(format($q$UPDATE public.stock SET user_id=%L WHERE id=%L$q$, public._id('u_b'), public._id('st_a'))));
-- Linha do piloto inacessível (PO-1 / US1-AC1)
SELECT public._chk(21, 'A não lê linha do piloto',      'ok:0', public._try(format('SELECT 1 FROM public.medicine_logs WHERE id=%L', public._id('pilot_log'))));
SELECT public._chk(22, 'A não altera linha do piloto',  'ok:0', public._try(format('UPDATE public.medicine_logs SET quantity_taken=3 WHERE id=%L', public._id('pilot_log'))));
SELECT public._chk(23, 'A não cria linha do piloto',    'err:42501', public._try(format($q$INSERT INTO public.medicine_logs (user_id,medicine_id,quantity_taken) VALUES ('00000000-0000-0000-0000-000000000001',%L,1)$q$, public._id('med_a'))));
RESET ROLE;

-- Intruso B
SELECT public._as(public._id('u_b'));
SET LOCAL ROLE authenticated;
SELECT public._chk(30, 'B não lê medicines de A',        'ok:0', public._try(format('SELECT 1 FROM public.medicines WHERE id=%L', public._id('med_a'))));
SELECT public._chk(31, 'B não lê protocols de A',        'ok:0', public._try(format('SELECT 1 FROM public.protocols WHERE id=%L', public._id('p_a'))));
SELECT public._chk(32, 'B não lê treatment_plans de A',  'ok:0', public._try(format('SELECT 1 FROM public.treatment_plans WHERE id=%L', public._id('tp_a'))));
SELECT public._chk(33, 'B não lê medicine_logs de A',    'ok:0', public._try(format('SELECT 1 FROM public.medicine_logs WHERE id=%L', public._id('log_a'))));
SELECT public._chk(34, 'B não lê stock de A',            'ok:0', public._try(format('SELECT 1 FROM public.stock WHERE id=%L', public._id('st_a'))));
SELECT public._chk(35, 'B não cria medicines em nome de A',   'err:42501', public._try(format($q$INSERT INTO public.medicines (user_id,name) VALUES (%L,'x')$q$, public._id('u_a'))));
SELECT public._chk(36, 'B não cria treatment_plans em nome de A','err:42501', public._try(format($q$INSERT INTO public.treatment_plans (user_id,name) VALUES (%L,'x')$q$, public._id('u_a'))));
SELECT public._chk(37, 'B não cria protocols em nome de A',   'err:42501', public._try(format($q$INSERT INTO public.protocols (user_id,name,start_date) VALUES (%L,'x',current_date)$q$, public._id('u_a'))));
SELECT public._chk(38, 'B não cria medicine_logs em nome de A','err:42501', public._try(format($q$INSERT INTO public.medicine_logs (user_id,quantity_taken) VALUES (%L,1)$q$, public._id('u_a'))));
SELECT public._chk(39, 'B não cria stock em nome de A',       'err:42501', public._try(format($q$INSERT INTO public.stock (user_id,quantity) VALUES (%L,1)$q$, public._id('u_a'))));
SELECT public._chk(40, 'B não altera medicines de A',    'ok:0', public._try(format($q$UPDATE public.medicines SET name='z' WHERE id=%L$q$, public._id('med_a'))));
SELECT public._chk(41, 'B não altera protocols de A',    'ok:0', public._try(format($q$UPDATE public.protocols SET name='z' WHERE id=%L$q$, public._id('p_a'))));
SELECT public._chk(42, 'B não altera treatment_plans de A','ok:0', public._try(format($q$UPDATE public.treatment_plans SET name='z' WHERE id=%L$q$, public._id('tp_a'))));
SELECT public._chk(43, 'B não altera medicine_logs de A','ok:0', public._try(format($q$UPDATE public.medicine_logs SET quantity_taken=7 WHERE id=%L$q$, public._id('log_a'))));
SELECT public._chk(44, 'B não altera stock de A',        'ok:0', public._try(format($q$UPDATE public.stock SET quantity=1 WHERE id=%L$q$, public._id('st_a'))));
SELECT public._chk(45, 'B não apaga medicines de A',     'ok:0', public._try(format('DELETE FROM public.medicines WHERE id=%L', public._id('med_del'))));
SELECT public._chk(46, 'B não apaga protocols de A',     'ok:0', public._try(format('DELETE FROM public.protocols WHERE id=%L', public._id('p_del'))));
SELECT public._chk(47, 'B não apaga treatment_plans de A','ok:0', public._try(format('DELETE FROM public.treatment_plans WHERE id=%L', public._id('tp_a'))));
SELECT public._chk(48, 'B não apaga medicine_logs de A', 'ok:0', public._try(format('DELETE FROM public.medicine_logs WHERE id=%L', public._id('log_a'))));
SELECT public._chk(49, 'B não apaga stock de A',         'ok:0', public._try(format('DELETE FROM public.stock WHERE id=%L', public._id('st_a'))));
SELECT public._chk(50, 'B não lê linha do piloto',       'ok:0', public._try(format('SELECT 1 FROM public.medicine_logs WHERE id=%L', public._id('pilot_log'))));
RESET ROLE;

-- Anônimo
SELECT public._as(NULL);
SET LOCAL ROLE anon;
SELECT public._chk(60, 'anon não lê medicines de A',     'ok:0', public._try(format('SELECT 1 FROM public.medicines WHERE id=%L', public._id('med_a'))));
SELECT public._chk(61, 'anon não lê medicine_logs de A', 'ok:0', public._try(format('SELECT 1 FROM public.medicine_logs WHERE id=%L', public._id('log_a'))));
SELECT public._chk(62, 'anon não lê linha do piloto',    'ok:0', public._try(format('SELECT 1 FROM public.medicine_logs WHERE id=%L', public._id('pilot_log'))));
SELECT public._chk(63, 'anon não cria linha do piloto',  'err:42501', public._try(format($q$INSERT INTO public.medicine_logs (user_id,medicine_id,quantity_taken) VALUES ('00000000-0000-0000-0000-000000000001',%L,1)$q$, public._id('med_a'))));
SELECT public._chk(64, 'anon não altera linha do piloto','ok:0', public._try(format('UPDATE public.medicine_logs SET quantity_taken=3 WHERE id=%L', public._id('pilot_log'))));
SELECT public._chk(65, 'anon não lê notification_log',   'ok:0', public._try(format('SELECT 1 FROM public.notification_log WHERE id=%L', public._id('nl_a'))));
RESET ROLE;

-- Dono A apaga (por último, para não interferir nos casos acima)
SELECT public._as(public._id('u_a'));
SET LOCAL ROLE authenticated;
SELECT public._chk(70, 'A apaga medicine_logs próprio',  'ok:1', public._try(format('DELETE FROM public.medicine_logs WHERE id=%L', public._id('log_a'))));
SELECT public._chk(71, 'A apaga stock próprio',          'ok:1', public._try(format('DELETE FROM public.stock WHERE id=%L', public._id('st_a'))));
SELECT public._chk(72, 'A apaga treatment_plans próprio','ok:1', public._try(format('DELETE FROM public.treatment_plans WHERE id=%L', public._id('tp_a'))));
-- medicines/protocols: trigger da 094 converte DELETE em arquivamento (ROW_COUNT 0, linha arquivada)
SELECT public._chk(73, 'A exclui protocols próprio (arquiva)', 'ok:0', public._try(format('DELETE FROM public.protocols WHERE id=%L', public._id('p_del'))));
SELECT public._chk(74, 'A exclui medicines próprio (arquiva)', 'ok:0', public._try(format('DELETE FROM public.medicines WHERE id=%L', public._id('med_del'))));
RESET ROLE;
SELECT public._chk(75, 'p_del e med_del arquivados pelo dono', 'true/true',
  (SELECT archived_at IS NOT NULL FROM public.protocols WHERE id = public._id('p_del'))::text || '/' ||
  (SELECT archived_at IS NOT NULL FROM public.medicines WHERE id = public._id('med_del'))::text);
SELECT public._chk(76, 'exclusões de B não tocaram em A (med_del/p_del existiam até o caso 73)', '1/1',
  (SELECT count(*) FROM public.medicines WHERE id = public._id('med_del'))::text || '/' ||
  (SELECT count(*) FROM public.protocols WHERE id = public._id('p_del'))::text);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — notification_log e user_settings (só o que o cliente usa)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as(public._id('u_a'));
SET LOCAL ROLE authenticated;
SELECT public._chk(80, 'A lê notification_log próprio',      'ok:1', public._try(format('SELECT 1 FROM public.notification_log WHERE id=%L', public._id('nl_a'))));
SELECT public._chk(81, 'A não cria notification_log',        'err:42501', public._try(format($q$INSERT INTO public.notification_log (user_id,notification_type) VALUES (%L,'x')$q$, public._id('u_a'))));
SELECT public._chk(82, 'A não altera notification_log',      'ok:0', public._try(format($q$UPDATE public.notification_log SET notification_type='y' WHERE id=%L$q$, public._id('nl_a'))));
SELECT public._chk(83, 'A não apaga notification_log',       'ok:0', public._try(format('DELETE FROM public.notification_log WHERE id=%L', public._id('nl_a'))));
SELECT public._chk(84, 'A lê user_settings próprio',         'ok:1', public._try(format('SELECT 1 FROM public.user_settings WHERE user_id=%L', public._id('u_a'))));
SELECT public._chk(85, 'A altera user_settings próprio',     'ok:1', public._try(format($q$UPDATE public.user_settings SET notification_mode='silent' WHERE user_id=%L$q$, public._id('u_a'))));
SELECT public._chk(86, 'A não apaga user_settings (sem política, C-2)', 'ok:0', public._try(format('DELETE FROM public.user_settings WHERE user_id=%L', public._id('u_a'))));
RESET ROLE;
SELECT public._as(public._id('u_b'));
SET LOCAL ROLE authenticated;
SELECT public._chk(87, 'B não lê notification_log de A',     'ok:0', public._try(format('SELECT 1 FROM public.notification_log WHERE id=%L', public._id('nl_a'))));
SELECT public._chk(88, 'B não lê user_settings de A',        'ok:0', public._try(format('SELECT 1 FROM public.user_settings WHERE user_id=%L', public._id('u_a'))));
SELECT public._chk(89, 'B não altera user_settings de A',    'ok:0', public._try(format($q$UPDATE public.user_settings SET notification_mode='silent' WHERE user_id=%L$q$, public._id('u_a'))));
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — bot_sessions só do servidor (PO-5, PO-SEC-1)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as(public._id('u_b'));
SET LOCAL ROLE authenticated;
SELECT public._chk(90, 'B não planta sessão no chat_id de A', 'err:42501', public._try(format($q$INSERT INTO public.bot_sessions (user_id,chat_id,context,expires_at) VALUES (%L,98001,'{"step":"plantado"}',now()+interval '1 hour')$q$, public._id('u_b'))));
SELECT public._chk(91, 'B não lê sessões',              'err:42501', public._try('SELECT 1 FROM public.bot_sessions WHERE chat_id=98001'));
SELECT public._chk(92, 'B não altera sessões',          'err:42501', public._try($q$UPDATE public.bot_sessions SET context='{"step":"x"}' WHERE chat_id=98001$q$));
SELECT public._chk(93, 'B não apaga sessões',           'err:42501', public._try('DELETE FROM public.bot_sessions WHERE chat_id=98001'));
RESET ROLE;
SELECT public._as(public._id('u_a'));
SET LOCAL ROLE authenticated;
SELECT public._chk(94, 'A (dono) também não lê a própria sessão', 'err:42501', public._try('SELECT 1 FROM public.bot_sessions WHERE chat_id=98001'));
RESET ROLE;
SELECT public._as(NULL);
SET LOCAL ROLE anon;
SELECT public._chk(95, 'anon não planta sessão',        'err:42501', public._try($q$INSERT INTO public.bot_sessions (user_id,chat_id,context,expires_at) VALUES ('00000000-0000-0000-0000-000000000001',98001,'{}',now()+interval '1 hour')$q$));
SELECT public._chk(96, 'anon não lê sessões',           'err:42501', public._try('SELECT 1 FROM public.bot_sessions'));
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public._chk(97, 'service_role grava sessão (caminho do sessionManager)', 'ok:1', public._try(format($q$INSERT INTO public.bot_sessions (user_id,chat_id,context,expires_at) VALUES (%L,98002,'{"step":"bot"}',now()+interval '1 hour')$q$, public._id('u_a'))));
SELECT public._chk(98, 'service_role lê sessão por chat_id', 'ok:1', public._try('SELECT context, expires_at FROM public.bot_sessions WHERE chat_id=98002'));
RESET ROLE;
SELECT public._chk(99, 'sessão real de A intacta', '{"step": "real"}',
  (SELECT context::text FROM public.bot_sessions WHERE chat_id = 98001));

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5 — funções e rastro do piloto (PO-3, PO-4, PO-SEC-2, PO-SEC-3)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._chk(100, 'migrate_pilot_data não existe', 'null', coalesce(to_regprocedure('public.migrate_pilot_data()')::text, 'null'));
SELECT public._chk(101, 'batch_update_review_status: anon/authenticated/service_role', 'false/false/true',
  has_function_privilege('anon', 'public.batch_update_review_status(uuid[],text,text)', 'EXECUTE')::text || '/' ||
  has_function_privilege('authenticated', 'public.batch_update_review_status(uuid[],text,text)', 'EXECUTE')::text || '/' ||
  has_function_privilege('service_role', 'public.batch_update_review_status(uuid[],text,text)', 'EXECUTE')::text);
SELECT public._chk(102, 'create_purchase_with_stock: anon/authenticated', 'false/true',
  has_function_privilege('anon', 'public.create_purchase_with_stock(uuid,numeric,numeric,date,date,text,text,text,text)', 'EXECUTE')::text || '/' ||
  has_function_privilege('authenticated', 'public.create_purchase_with_stock(uuid,numeric,numeric,date,date,text,text,text,text)', 'EXECUTE')::text);
SELECT public._chk(103, 'generate_telegram_token: anon/authenticated', 'false/true',
  has_function_privilege('anon', 'public.generate_telegram_token()', 'EXECUTE')::text || '/' ||
  has_function_privilege('authenticated', 'public.generate_telegram_token()', 'EXECUTE')::text);
SELECT public._chk(104, 'bot_sessions sem grant de tabela p/ anon e authenticated', '0',
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='bot_sessions' AND grantee IN ('anon','authenticated'))::text);
SELECT public._chk(105, 'nenhuma política Pilot_*, com o id do piloto ou true nas 8 tabelas', '0',
  (SELECT count(*) FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('bot_sessions','medicine_logs','medicines','notification_log','protocols','stock','treatment_plans','user_settings')
    AND (policyname LIKE 'Pilot\_%' OR qual = 'true' OR with_check = 'true'
         OR coalesce(qual,'') LIKE '%000000000001%' OR coalesce(with_check,'') LIKE '%000000000001%'))::text);
SELECT public._chk(106, 'toda política nova é TO authenticated com (select auth.uid())', '0',
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%\_owner\_%'
    AND (roles <> '{authenticated}' OR coalesce(qual, with_check) NOT LIKE '%SELECT auth.uid()%'))::text);
SELECT public._chk(107, 'UPDATE do dono tem WITH CHECK = USING', '0',
  (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%\_owner\_update'
    AND with_check IS DISTINCT FROM qual)::text);
-- linha do piloto da fixture 'pilot_log' é do teste; a original sumiu na migração (PO-3)
SELECT public._chk(108, 'linha original do piloto apagada (só resta a da fixture)', '1',
  (SELECT count(*) FROM public.medicine_logs WHERE user_id='00000000-0000-0000-0000-000000000001')::text);

-- Negativo: reaplicar a pré-checagem com o banco já migrado tem que falhar
DO $$ DECLARE v text := 'sem erro'; BEGIN
  BEGIN
    IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'Pilot\_%') <> 32 THEN
      RAISE EXCEPTION 'pré-checagem barrou';
    END IF;
  EXCEPTION WHEN OTHERS THEN v := SQLERRM; END;
  PERFORM public._chk(109, 'migração reaplicada é barrada na pré-checagem', 'pré-checagem barrou', v);
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULTADO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT n, CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS r, caso, esperado, obtido
FROM public._r ORDER BY n;

ROLLBACK;
