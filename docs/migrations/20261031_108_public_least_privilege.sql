-- Spec 108 Slice A — privilégio mínimo no schema `public` + DROP das 4 tabelas mortas da 099 (ADR-119).
-- Uma transação, ordem fixa (plan.md §Architecture): 0 pré-checks → 1 DROPs → 2 exclusão de conta →
-- 3 padrões (A′) → 4 revogação do excesso → 5 re-GRANT por coluna → 6 re-GRANT de anon → 7 pós-checks.
-- Fonte de toda revogação: docs/migrations/20261031_108_matrix.md (INV-3; aprovada pelo PO 2026-10-31).
-- Rollback de privilégio: 20261031_108_acl_restore_<qa|prod>.sql (FR-012). DROP das tabelas vazias não
-- tem rollback e não precisa (INV-2: aborta se houver linha).
--
-- R-270 — Failure Modes (plan.md FM-1…14, reconferidos em analysis-A.md):
--   FM-1  tabela morta ganhou linha        → pré-check count = 0, RAISE (INV-2)
--   FM-2  função/view ainda cita as 4      → pós-check em pg_proc.prosrc + pg_depend, RAISE
--   FM-3  update_updated_at_column         → NÃO dropada (compartilhada); só update_push_subscriptions_updated_at
--   FM-4  _delete_user_account_core velha  → base = pg_get_functiondef de PROD (2026-10-31), só 3 DELETEs a menos
--   FM-5  REVOKE de tabela apaga coluna    → passo 5 reemite app_version_gate/consent_log; pós-check INV-5
--   FM-7  capture_access                   → não tocado (schema access_hook); pós-check INV-5
--   FM-8  IN SCHEMA … FROM PUBLIC = no-op  → revogação GLOBAL (A′); PO-SEC-3 no .test.sql cria função e mede
--   FM-9  função nova de extensão          → devolução IN SCHEMA extensions; PO-10 no .test.sql
--   FM-10 §3 da 067 (UPDATE dose_instances)→ snapshot antes/depois NESTA transação, RAISE se mudar (INV-6/PO-SEC-2)
--   FM-11 dono ≠ postgres                  → pré-check RAISE
--   FM-12 user_emails/feedback_stats       → pós-check INV-7
--   FM-13 MAINTAIN                         → PG 17.11 em prod e QA (analysis-A.md)
--   FM-14 transação parcial                → tudo aqui dentro; qualquer RAISE desfaz
--
-- RC-SEC: estritamente redutora. Nenhum GRANT novo além da reemissão do que já existia
-- (colunas de app_version_gate/consent_log e consent_policy a anon).

BEGIN;

-- ─── 0. Pré-checks ──────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_n bigint; v_t text;
BEGIN
  FOREACH v_t IN ARRAY ARRAY['push_notification_logs','push_subscriptions','dose_adherence_monthly','gemini_reviews'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_t) INTO v_n;
    IF v_n <> 0 THEN RAISE EXCEPTION 'INV-2: public.% tem % linha(s) — DROP abortado', v_t, v_n; END IF;
  END LOOP;

  SELECT count(*) INTO v_n FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','m','S','p')
     AND c.relowner <> 'postgres'::regrole;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FM-11: % relação(ões) do public com dono ≠ postgres', v_n; END IF;
  SELECT count(*) INTO v_n FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proowner <> 'postgres'::regrole;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FM-11: % função(ões) do public com dono ≠ postgres', v_n; END IF;
END $$;

-- INV-6 / PO-SEC-2: UPDATE de authenticated em dose_instances (tabela + toda coluna) ANTES.
CREATE TEMP TABLE _108_di_update_before ON COMMIT DROP AS
SELECT a.attname,
       has_column_privilege('authenticated', 'public.dose_instances'::regclass, a.attnum, 'UPDATE') AS col_upd
  FROM pg_attribute a
 WHERE a.attrelid = 'public.dose_instances'::regclass AND a.attnum > 0 AND NOT a.attisdropped
UNION ALL
SELECT '<tabela>', has_table_privilege('authenticated', 'public.dose_instances', 'UPDATE');

-- ─── 1. DROPs (FR-007, FR-009) ──────────────────────────────────────────────────────────────
DROP FUNCTION public.batch_update_review_status(uuid[], text, text);
-- Sem CASCADE de propósito: dependência não mapeada aborta em vez de levar objeto junto.
-- Os gatilhos das tabelas caem com elas; a função de gatilho exclusiva sai em seguida.
DROP TABLE public.push_notification_logs;
DROP TABLE public.push_subscriptions;
DROP TABLE public.dose_adherence_monthly;
DROP TABLE public.gemini_reviews;
DROP FUNCTION public.update_push_subscriptions_updated_at();
-- update_updated_at_column() fica: compartilhada por outras tabelas (FM-3).

-- ─── 2. Exclusão de conta sem as tabelas apagadas (FR-008, INV-1) ───────────────────────────
-- Base: pg_get_functiondef('public._delete_user_account_core(uuid)') de PROD em 2026-10-31
-- (= 20261020_107_prune_queue.sql:206). Diferença: saem os DELETEs de push_notification_logs,
-- push_subscriptions e gemini_reviews. As demais tabelas com user_id caem por FK ON DELETE CASCADE
-- a auth.users (provado no .test.sql, PO-5).
-- migration-grants: ok — CREATE OR REPLACE preserva a ACL atual (só postgres); chamada só por DEFINERs
CREATE OR REPLACE FUNCTION public._delete_user_account_core(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text; v_policy_version text; v_created_at timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  SELECT u.email, u.created_at INTO v_email, v_created_at FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  -- 107 (FR-013, Marco Civil art. 15 + LGPD art. 16, I): vincula o access_log ao e-mail por 6 meses.
  -- Mesma transação: sem lápide, sem exclusão (INV-7). Purga em private.purge_access_log().
  INSERT INTO private.account_tombstone (user_id, email, subject_hash, account_created_at)
  VALUES (p_user_id, v_email, public.consent_subject_hash(v_email), v_created_at);

  -- 094: libera o DELETE efetivo em protocols/medicines (trigger de arquivamento). Local à
  -- transação; a guarda de papel no trigger impede que a pessoa reaproveite a flag.
  PERFORM set_config('dosiq.hard_delete', 'on', true);

  SELECT c.policy_version INTO v_policy_version FROM public.consent_log c
   WHERE c.user_id = p_user_id AND c.action IN ('granted','revoked')
   ORDER BY c.created_at DESC LIMIT 1;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (p_user_id, public.consent_subject_hash(v_email), 'health_data', 'account_deleted', v_policy_version, 'server');

  DELETE FROM public.stock_consumptions        WHERE user_id = p_user_id;
  DELETE FROM public.stock_adjustments         WHERE user_id = p_user_id;
  DELETE FROM public.medicine_logs             WHERE user_id = p_user_id;
  DELETE FROM public.stock                     WHERE user_id = p_user_id;
  DELETE FROM public.purchases                 WHERE user_id = p_user_id;
  DELETE FROM public.failed_notification_queue WHERE user_id = p_user_id;
  DELETE FROM public.notification_log          WHERE user_id = p_user_id;
  DELETE FROM public.notification_devices      WHERE user_id = p_user_id;
  DELETE FROM public.bot_sessions              WHERE user_id = p_user_id;
  -- 090: etapas referenciam medicines (NO ACTION) — escada sai antes (etapas em CASCADE).
  DELETE FROM public.titrations                WHERE user_id = p_user_id;
  DELETE FROM public.protocols                 WHERE user_id = p_user_id;
  DELETE FROM public.treatment_plans           WHERE user_id = p_user_id;
  DELETE FROM public.medicines                 WHERE user_id = p_user_id;
  DELETE FROM public.user_settings             WHERE user_id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
END; $function$;

-- ─── 3. Padrões de privilégio (FR-001, decisão A′) ──────────────────────────────────────────
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
-- O EXECUTE a PUBLIC é o padrão EMBUTIDO (sem linha em pg_default_acl): só a forma global o remove.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- …e devolve só em `extensions` (pgcrypto/uuid-ossp do postgres; uuid_generate_v4() é default de coluna).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

-- ─── 4. Excesso atual (FR-003, FR-004; matriz §1-§3) ────────────────────────────────────────
-- anon: nada no public (allowlist reemitida nos passos 5-6).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;
-- authenticated: perde TRUNCATE/REFERENCES/TRIGGER/MAINTAIN em tudo; mantém S/I/U/D (decisão Q-2).
-- Não toca UPDATE ⇒ dose_instances intacta (INV-6).
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM authenticated;
-- authenticated: relações sem uso (matriz §2) e sequências (inserts só via DEFINER/service_role).
REVOKE ALL ON TABLE public.stock_adjustments, public.stock_consumptions,
                    public.v_dose_critical_summary, public.v_dose_critical_trace FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
-- authenticated: views só leitura.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.medicine_stock_summary, public.v_adherence_heatmap,
                                       public.v_daily_adherence FROM authenticated;
-- EXECUTE de authenticated: todos os grants atuais são explícitos e estão na matriz §3 — nada a revogar.

-- ─── 5. Re-GRANT por coluna (FM-5; a revogação de tabela os apaga) ──────────────────────────
GRANT SELECT (platform, min_supported_version, is_active, message, store_url)
  ON TABLE public.app_version_gate TO anon, authenticated;
GRANT SELECT (id, consent_type, action, policy_version, platform, created_at)
  ON TABLE public.consent_log TO authenticated;
GRANT SELECT (seq) ON TABLE public.consent_log TO service_role;

-- ─── 6. Re-GRANT de anon (INV-5) ────────────────────────────────────────────────────────────
GRANT SELECT ON TABLE public.consent_policy TO anon;

-- ─── 7. Pós-checks ──────────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_n bigint; v_list text;
BEGIN
  -- FM-2 / PO-5: nada cita as 4 tabelas nem a função apagada.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_list FROM pg_proc p
   WHERE p.pronamespace IN ('public'::regnamespace, 'private'::regnamespace)
     AND p.prosrc ~ '(push_notification_logs|push_subscriptions|dose_adherence_monthly|gemini_reviews|batch_update_review_status)';
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'FM-2: função ainda cita objeto apagado: %', v_list; END IF;
  IF to_regclass('public.push_notification_logs') IS NOT NULL OR to_regclass('public.push_subscriptions') IS NOT NULL
     OR to_regclass('public.dose_adherence_monthly') IS NOT NULL OR to_regclass('public.gemini_reviews') IS NOT NULL THEN
    RAISE EXCEPTION 'US-4: tabela morta sobreviveu'; END IF;

  -- anon: nenhuma relação do public por privilégio de tabela, exceto consent_policy SELECT.
  SELECT string_agg(c.relname || ':' || x, ', ') INTO v_list
    FROM pg_class c CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) x
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','m','p')
     AND has_table_privilege('anon', c.oid, x)
     AND NOT (c.relname = 'consent_policy' AND x = 'SELECT');
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'SC-002: anon com privilégio fora da matriz: %', v_list; END IF;
  SELECT string_agg(c.relname, ', ') INTO v_list FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
     AND (has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE') OR has_sequence_privilege('authenticated', c.oid, 'USAGE,SELECT,UPDATE'));
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'matriz §2: sequência ainda aberta: %', v_list; END IF;

  -- anon e PUBLIC: nenhum EXECUTE em função do public.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_list FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0));
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'FR-004: anon/PUBLIC ainda executa: %', v_list; END IF;

  -- authenticated: nenhum TRUNCATE/REFERENCES/TRIGGER/MAINTAIN.
  SELECT string_agg(c.relname || ':' || x, ', ') INTO v_list
    FROM pg_class c CROSS JOIN unnest(ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) x
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','v','m','p')
     AND has_table_privilege('authenticated', c.oid, x);
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'FR-003: authenticated ainda tem: %', v_list; END IF;

  -- INV-5: allowlist do anon de pé.
  SELECT count(*) INTO v_n FROM unnest(ARRAY['platform','min_supported_version','is_active','message','store_url']) col
   WHERE has_column_privilege('anon', 'public.app_version_gate', col, 'SELECT')
     AND has_column_privilege('authenticated', 'public.app_version_gate', col, 'SELECT');
  IF v_n <> 5 THEN RAISE EXCEPTION 'INV-5: app_version_gate com %/5 colunas legíveis por anon+authenticated', v_n; END IF;
  IF NOT has_table_privilege('anon', 'public.consent_policy', 'SELECT') THEN RAISE EXCEPTION 'INV-5: anon sem consent_policy'; END IF;
  IF NOT has_function_privilege('anon', 'access_hook.capture_access()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'access_hook.capture_access()', 'EXECUTE') THEN
    RAISE EXCEPTION 'INV-5: capture_access sem EXECUTE — indisponibilidade total'; END IF;
  SELECT count(*) INTO v_n FROM unnest(ARRAY['id','consent_type','action','policy_version','platform','created_at']) col
   WHERE has_column_privilege('authenticated', 'public.consent_log', col, 'SELECT');
  IF v_n <> 6 THEN RAISE EXCEPTION 'FM-5: consent_log com %/6 colunas para authenticated', v_n; END IF;

  -- INV-7: views DEFINER sobre auth.users fechadas.
  IF has_table_privilege('anon', 'public.user_emails', 'SELECT') OR has_table_privilege('authenticated', 'public.user_emails', 'SELECT')
     OR has_table_privilege('anon', 'public.feedback_stats', 'SELECT') OR has_table_privilege('authenticated', 'public.feedback_stats', 'SELECT') THEN
    RAISE EXCEPTION 'INV-7: user_emails/feedback_stats abertas'; END IF;

  -- INV-6 / PO-SEC-2: UPDATE de dose_instances idêntico ao de antes.
  SELECT string_agg(b.attname, ', ') INTO v_list FROM _108_di_update_before b
   WHERE b.col_upd IS DISTINCT FROM CASE WHEN b.attname = '<tabela>'
           THEN has_table_privilege('authenticated', 'public.dose_instances', 'UPDATE')
           ELSE has_column_privilege('authenticated', 'public.dose_instances', b.attname, 'UPDATE') END;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'INV-6: UPDATE de dose_instances mudou em: %', v_list; END IF;

  -- SC-001: padrões do postgres no public sem anon/authenticated.
  SELECT count(*) INTO v_n FROM pg_default_acl d, aclexplode(d.defaclacl) a
   WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace
     AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole);
  IF v_n <> 0 THEN RAISE EXCEPTION 'SC-001: % padrão(ões) do public ainda abertos', v_n; END IF;
END $$;

COMMIT;
