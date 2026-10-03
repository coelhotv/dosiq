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
