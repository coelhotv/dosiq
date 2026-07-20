-- 20260708_consent_log.test.sql — 046 Slice A (T002 + T002b + T008b)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270). Não deixa rastro.
-- Auto-contido: aplica as 3 migrações do Slice A DENTRO da transação (DDL é transacional no
-- Postgres), ataca, prova, e desfaz tudo. Rodar ANTES de aplicar em prod.
--
-- O pepper de TESTE entra pelo GUC de fallback (`app.consent_pepper`) — o Vault de prod não é
-- tocado. Em prod o valor real vive no Vault; aqui só importa que o HMAC seja determinístico.
--
-- ┌─ T002 — a trilha é forjável pelo próprio auditado? (PO-SEC-1) ────────────────────────────┐
-- | # | Ataque                                                          | Esperado             |
-- |---|-----------------------------------------------------------------|----------------------|
-- | 1 | authenticated: INSERT DIRETO `granted` retroativo                | permission denied    |
-- | 2 | authenticated: INSERT DIRETO `account_deleted` forjado           | permission denied    |
-- | 3 | authenticated: SELECT de evento de OUTRO usuário (cross-user)    | 0 linhas (RLS)       |
-- | 4 | authenticated: UPDATE do PRÓPRIO evento (reescrever a história)  | permission denied    |
-- | 5 | authenticated: DELETE do PRÓPRIO evento (sumir com a prova)      | permission denied    |
-- | 6 | authenticated: SELECT de linha ÓRFÃ (user_id NULL)               | 0 linhas (RLS)       |
-- | 7 | anon: SELECT em consent_log                                      | permission denied    |
-- | 8 | anon: EXECUTE consent_grant                                      | permission denied    |
-- | 9 | POSITIVO: consent_grant do titular grava e CARIMBA server-side   | 1 linha, campos OK   |
-- |10 | POSITIVO: anti-flood S6 (2ª chamada < 10s)                       | no-op, mesmo id      |
-- |11 | consent_grant NÃO aceita ação do controlador (não há parâmetro)  | função inexistente   |
-- └───────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ T002b — RC-SEC (PO-SEC-2 / PO-SEC-4) ────────────────────────────────────────────────────┐
-- |12 | authenticated: delete_user_account_by_id(<OUTRO user>)           | permission denied    |
-- |13 | authenticated: delete_user_account_by_id(<próprio>)              | permission denied    |
-- |14 | GRANT FORÇADO + authenticated chama _by_id(<OUTRO>)              | RAISE 'forbidden'    |
-- |15 | conta-alvo dos ataques 12-14 segue INTACTA                       | usuário existe       |
-- |16 | authenticated: current_setting('app.consent_pepper')             | NULL — GUC não é fonte|
--    ↑ REGRESSÃO: na 1ª rodada este caso FALHOU (o fallback por GUC do S3 entregava o pepper a
--      qualquer authenticated — GUC não tem ACL). O fallback foi REMOVIDO; o assert fica de guarda.
-- |17 | authenticated: SELECT * FROM vault.decrypted_secrets             | permission denied    |
-- |18 | authenticated: EXECUTE consent_pepper()                          | permission denied    |
-- |19 | authenticated: SELECT subject_hash / user_id de consent_log      | permission denied    |
-- |20 | authenticated: SELECT das colunas PERMITIDAS (getStatus)         | funciona             |
-- └───────────────────────────────────────────────────────────────────────────────────────────┘
--
-- ┌─ T008b — PO-6: a exclusão apaga tudo E deixa o recibo ────────────────────────────────────┐
-- |21 | zero linhas do titular em TODA tabela com user_id (menos consent_log) | 0 linhas        |
-- |22 | auth.users sem a conta                                            | 0 linhas            |
-- |23 | consent_log com as linhas dele: user_id NULL + subject_hash cheio  | órfãs, hash intacto |
-- |24 | evento `account_deleted` presente (o recibo)                       | 1 linha             |
-- |25 | recomputar o HMAC do e-mail original reencontra as linhas          | requerimento OK     |
-- |26 | wrapper preserva `active_treatments_block` (regra de UX — S1)      | RAISE               |
-- └───────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 0 — as 3 migrações do Slice A (idênticas aos arquivos; DDL é transacional)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.consent_policy (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version text NOT NULL CHECK (length(trim(version)) > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.consent_policy (id, version) VALUES (1, '0.2') ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.consent_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_policy_select_all ON public.consent_policy;
CREATE POLICY consent_policy_select_all ON public.consent_policy FOR SELECT TO authenticated, anon USING (true);
REVOKE ALL ON public.consent_policy FROM PUBLIC;
GRANT SELECT ON public.consent_policy TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_policy TO service_role;

CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_hash text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  consent_type text NOT NULL CHECK (consent_type IN ('health_data', 'terms_privacy')),
  action text NOT NULL CHECK (action IN ('granted','revoked','notice_sent','pruned','account_deleted')),
  policy_version text CHECK (policy_version IS NULL OR length(trim(policy_version)) > 0),
  platform text NOT NULL CHECK (platform IN ('web','mobile','server')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_log_consent_requires_version CHECK (
    action NOT IN ('granted','revoked') OR policy_version IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_consent_log_user_type_created ON public.consent_log (user_id, consent_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_log_subject_hash ON public.consent_log (subject_hash);
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_log_select_own ON public.consent_log;
CREATE POLICY consent_log_select_own ON public.consent_log FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.consent_log FROM PUBLIC;
REVOKE ALL ON public.consent_log FROM anon;
REVOKE ALL ON public.consent_log FROM authenticated;
GRANT SELECT (id, consent_type, action, policy_version, platform, created_at) ON public.consent_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_log TO service_role;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS consent_prompt_sessions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consent_prompt_last_seen_at timestamptz;

CREATE OR REPLACE FUNCTION public.consent_pepper()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_pepper text;
BEGIN
  SELECT s.decrypted_secret INTO v_pepper FROM vault.decrypted_secrets s
   WHERE s.name = 'CONSENT_HASH_PEPPER' LIMIT 1;
  IF v_pepper IS NULL OR length(trim(v_pepper)) = 0 THEN
    RAISE EXCEPTION 'consent_pepper_missing';
  END IF;
  RETURN v_pepper;
END; $fn$;
REVOKE ALL ON FUNCTION public.consent_pepper() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consent_subject_hash(p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email = '' THEN RAISE EXCEPTION 'consent_subject_email_missing'; END IF;
  RETURN encode(extensions.hmac(v_email, public.consent_pepper(), 'sha256'), 'hex');
END; $fn$;
REVOKE ALL ON FUNCTION public.consent_subject_hash(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consent_write(p_action text, p_consent_type text, p_platform text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_email text; v_policy_version text; v_last_id uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_action NOT IN ('granted','revoked') THEN RAISE EXCEPTION 'consent_action_not_allowed'; END IF;
  IF p_consent_type NOT IN ('health_data','terms_privacy') THEN RAISE EXCEPTION 'consent_type_invalid'; END IF;
  IF p_platform NOT IN ('web','mobile','server') THEN RAISE EXCEPTION 'consent_platform_invalid'; END IF;

  SELECT c.id INTO v_last_id FROM public.consent_log c
   WHERE c.user_id = v_uid AND c.consent_type = p_consent_type
   ORDER BY c.created_at DESC LIMIT 1;

  IF v_last_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.consent_log c
     WHERE c.id = v_last_id AND c.action = p_action
       AND c.created_at > now() - interval '10 seconds'
  ) THEN
    RETURN v_last_id;
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  IF v_email IS NULL THEN RAISE EXCEPTION 'consent_subject_email_missing'; END IF;

  SELECT p.version INTO v_policy_version FROM public.consent_policy p WHERE p.id = 1;
  IF v_policy_version IS NULL THEN RAISE EXCEPTION 'consent_policy_version_missing'; END IF;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (v_uid, public.consent_subject_hash(v_email), p_consent_type, p_action, v_policy_version, p_platform)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $fn$;
REVOKE ALL ON FUNCTION public.consent_write(text,text,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consent_grant(p_consent_type text, p_platform text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT public.consent_write('granted', p_consent_type, p_platform);
$fn$;
CREATE OR REPLACE FUNCTION public.consent_revoke(p_consent_type text, p_platform text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT public.consent_write('revoked', p_consent_type, p_platform);
$fn$;
REVOKE EXECUTE ON FUNCTION public.consent_grant(text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consent_revoke(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consent_grant(text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consent_revoke(text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._delete_user_account_core(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_email text; v_policy_version text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

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
  DELETE FROM public.push_notification_logs    WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions        WHERE user_id = p_user_id;
  DELETE FROM public.bot_sessions              WHERE user_id = p_user_id;
  DELETE FROM public.protocols                 WHERE user_id = p_user_id;
  DELETE FROM public.treatment_plans           WHERE user_id = p_user_id;
  DELETE FROM public.medicines                 WHERE user_id = p_user_id;
  DELETE FROM public.gemini_reviews            WHERE user_id = p_user_id;
  DELETE FROM public.user_settings             WHERE user_id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
END; $fn$;
REVOKE ALL ON FUNCTION public._delete_user_account_core(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_user_account_by_id(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE v_caller text := coalesce(auth.role(), current_user::text);
BEGIN
  IF v_caller <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM public._delete_user_account_core(p_user_id);
END; $fn$;
REVOKE EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE uid uuid := auth.uid(); active_count integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT count(*) INTO active_count FROM public.protocols
   WHERE user_id = uid AND active = true AND (end_date IS NULL OR end_date >= current_date);
  IF active_count > 0 THEN
    RAISE EXCEPTION 'active_treatments_block' USING DETAIL = active_count::text;
  END IF;
  PERFORM public._delete_user_account_core(uid);
END; $fn$;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1 — fixtures
-- ═══════════════════════════════════════════════════════════════════════════════
-- Pepper: SÓ Vault. Se ainda não estiver provisionado, cria um efêmero (o ROLLBACK o descarta).
-- Nenhum assert depende do VALOR do pepper — só do fato de ele ser determinístico na transação.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'CONSENT_HASH_PEPPER') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'CONSENT_HASH_PEPPER',
      'Pepper efêmero de teste (046) — descartado no ROLLBACK.'
    );
  END IF;
END $$;

CREATE TABLE public._r (n int, caso text, esperado text, obtido text, ok boolean);
GRANT ALL ON public._r TO authenticated, anon, service_role;

CREATE TABLE public._ids (k text PRIMARY KEY, v uuid);
GRANT SELECT ON public._ids TO authenticated, anon, service_role;
INSERT INTO public._ids (k, v) VALUES
  ('u_a', gen_random_uuid()),   -- titular do PO-6 (será excluído)
  ('u_b', gen_random_uuid()),   -- vítima dos ataques cross-user / IDOR
  ('u_c', gen_random_uuid()),   -- titular com tratamento ATIVO (assert 26)
  ('med_a', gen_random_uuid()),
  ('prot_a', gen_random_uuid()),
  ('prot_c', gen_random_uuid()),
  ('plan_a', gen_random_uuid()),
  ('log_a', gen_random_uuid()),
  ('stock_a', gen_random_uuid());

INSERT INTO auth.users (id, email)
SELECT v, k || '-046@test.local' FROM public._ids WHERE k IN ('u_a','u_b','u_c');

-- Helper: assume a role de um usuário autenticado (simula o que o PostgREST faz com o JWT).
CREATE OR REPLACE FUNCTION public._as_user(p_uid uuid) RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text, true);
END; $fn$;
GRANT EXECUTE ON FUNCTION public._as_user(uuid) TO authenticated, anon, service_role;

-- Evento legítimo do usuário B (alvo do cross-user) — via RPC, como manda o desenho.
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_b'));
SET LOCAL ROLE authenticated;
SELECT public.consent_grant('health_data', 'web');
RESET ROLE;

-- Linha ÓRFÃ (user_id NULL) — simula titular já excluído. Só service_role deve enxergar.
INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
VALUES (NULL, repeat('a', 64), 'health_data', 'account_deleted', '0.2', 'server');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2 — T002: a trilha é forjável? (PO-SEC-1)
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;

DO $$
DECLARE v_uid uuid := (SELECT v FROM public._ids WHERE k='u_a');
        v_cnt int; v_id1 uuid; v_id2 uuid; v_row record;
BEGIN
  -- 1. INSERT DIRETO de um `granted` RETROATIVO
  BEGIN
    INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform, created_at)
    VALUES (v_uid, repeat('b',64), 'health_data', 'granted', '0.1', 'web', now() - interval '1 year');
    INSERT INTO public._r VALUES (1,'authenticated: INSERT direto `granted` retroativo','permission denied','INSERT PASSOU — trilha forjável',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (1,'authenticated: INSERT direto `granted` retroativo','permission denied',SQLERRM,SQLSTATE='42501');
  END;

  -- 2. INSERT DIRETO de um `account_deleted` FORJADO
  BEGIN
    INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
    VALUES (v_uid, repeat('c',64), 'health_data', 'account_deleted', '0.2', 'server');
    INSERT INTO public._r VALUES (2,'authenticated: INSERT direto `account_deleted` forjado','permission denied','INSERT PASSOU — recibo fabricável',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (2,'authenticated: INSERT direto `account_deleted` forjado','permission denied',SQLERRM,SQLSTATE='42501');
  END;

  -- 3. cross-user SELECT (A tentando ler o evento de B)
  SELECT count(*) INTO v_cnt FROM public.consent_log;
  INSERT INTO public._r VALUES (3,'authenticated(A): SELECT vê eventos de B ou órfãos?','0 linhas',v_cnt||' linha(s) visível(is)', v_cnt = 0);

  -- 9. POSITIVO: consent_grant grava e carimba server-side
  v_id1 := public.consent_grant('health_data', 'mobile');
  INSERT INTO public._r VALUES (9,'POSITIVO: consent_grant do titular','1 linha gravada', coalesce(v_id1::text,'NULL'), v_id1 IS NOT NULL);

  -- 10. POSITIVO: anti-flood S6 (2ª chamada imediata = no-op, mesmo id)
  v_id2 := public.consent_grant('health_data', 'mobile');
  INSERT INTO public._r VALUES (10,'anti-flood S6: 2ª chamada < 10s','no-op, mesmo id',
    CASE WHEN v_id1 = v_id2 THEN 'mesmo id (no-op)' ELSE 'DUPLICOU a trilha' END, v_id1 = v_id2);

  -- 4. UPDATE do PRÓPRIO evento (reescrever a história)
  BEGIN
    UPDATE public.consent_log SET action = 'revoked' WHERE id = v_id1;
    INSERT INTO public._r VALUES (4,'authenticated: UPDATE do próprio evento','permission denied','UPDATE PASSOU — história reescrita',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (4,'authenticated: UPDATE do próprio evento','permission denied',SQLERRM,SQLSTATE='42501');
  END;

  -- 5. DELETE do PRÓPRIO evento (sumir com a prova)
  BEGIN
    DELETE FROM public.consent_log WHERE id = v_id1;
    INSERT INTO public._r VALUES (5,'authenticated: DELETE do próprio evento','permission denied','DELETE PASSOU — prova apagável',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (5,'authenticated: DELETE do próprio evento','permission denied',SQLERRM,SQLSTATE='42501');
  END;

  -- 6. SELECT de linha ÓRFÃ (user_id NULL) — a trilha do CONTROLADOR
  SELECT count(*) INTO v_cnt FROM public.consent_log WHERE action = 'account_deleted';
  INSERT INTO public._r VALUES (6,'authenticated: SELECT de linha órfã (user_id NULL)','0 linhas',v_cnt||' linha(s)', v_cnt = 0);

  -- 20. POSITIVO: as colunas PERMITIDAS seguem legíveis (getStatus não quebra)
  SELECT c.consent_type, c.action, c.policy_version, c.platform INTO v_row
    FROM public.consent_log c ORDER BY c.created_at DESC LIMIT 1;
  INSERT INTO public._r VALUES (20,'authenticated: SELECT das colunas do grant (getStatus)','funciona',
    format('%s/%s/v%s/%s', v_row.consent_type, v_row.action, v_row.policy_version, v_row.platform),
    v_row.action = 'granted' AND v_row.policy_version = '0.2');

  -- 19. subject_hash / user_id fora do grant de coluna (S4)
  BEGIN
    PERFORM c.subject_hash FROM public.consent_log c LIMIT 1;
    INSERT INTO public._r VALUES (19,'authenticated: SELECT subject_hash (S4)','permission denied','LEU o hash — oráculo e-mail↔hash',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (19,'authenticated: SELECT subject_hash (S4)','permission denied',SQLERRM,SQLSTATE='42501');
  END;

  -- 16. O GUC NÃO É FONTE DE PEPPER (regressão do achado que derrubou o fallback do S3).
  -- Se alguém reintroduzir `app.consent_pepper`, este assert acusa: authenticated lê GUC sem ACL.
  INSERT INTO public._r VALUES (16,'authenticated: current_setting(app.consent_pepper)','NULL — GUC não é fonte de pepper',
    coalesce(current_setting('app.consent_pepper', true),'(NULL)'),
    coalesce(current_setting('app.consent_pepper', true),'') = '');

  BEGIN
    PERFORM public.consent_pepper();
    INSERT INTO public._r VALUES (18,'authenticated: EXECUTE consent_pepper()','permission denied','EXECUTOU — pepper exposto',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (18,'authenticated: EXECUTE consent_pepper()','permission denied',SQLERRM,SQLSTATE='42501');
  END;

  -- 17. Vault
  BEGIN
    PERFORM 1 FROM vault.decrypted_secrets LIMIT 1;
    INSERT INTO public._r VALUES (17,'authenticated: SELECT vault.decrypted_secrets','permission denied','LEU o Vault',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (17,'authenticated: SELECT vault.decrypted_secrets','permission denied',SQLERRM,true);
  END;

  -- 12/13. IDOR de exclusão de conta
  BEGIN
    PERFORM public.delete_user_account_by_id((SELECT v FROM public._ids WHERE k='u_b'));
    INSERT INTO public._r VALUES (12,'authenticated: delete_user_account_by_id(OUTRO user)','permission denied','APAGOU CONTA ALHEIA',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (12,'authenticated: delete_user_account_by_id(OUTRO user)','permission denied',SQLERRM,SQLSTATE='42501');
  END;

  BEGIN
    PERFORM public.delete_user_account_by_id(v_uid);
    INSERT INTO public._r VALUES (13,'authenticated: delete_user_account_by_id(próprio)','permission denied','EXECUTOU o núcleo sem passar pelo wrapper',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (13,'authenticated: delete_user_account_by_id(próprio)','permission denied',SQLERRM,SQLSTATE='42501');
  END;
END $$;

RESET ROLE;

-- 11. consent_grant não tem parâmetro de ação — `account_deleted` não é alcançável pela API do titular
DO $$
BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='consent_grant'
     AND pg_get_function_identity_arguments(p.oid) = 'p_consent_type text, p_platform text';
  IF FOUND THEN
    INSERT INTO public._r VALUES (11,'consent_grant não aceita `action` como parâmetro','sem parâmetro de ação','assinatura (p_consent_type, p_platform)',true);
  ELSE
    INSERT INTO public._r VALUES (11,'consent_grant não aceita `action` como parâmetro','sem parâmetro de ação','assinatura inesperada',false);
  END IF;
END $$;

-- 7/8. anon
SELECT set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
SET LOCAL ROLE anon;
DO $$
DECLARE v_cnt int;
BEGIN
  BEGIN
    SELECT count(*) INTO v_cnt FROM public.consent_log;
    INSERT INTO public._r VALUES (7,'anon: SELECT em consent_log','permission denied', v_cnt||' linha(s) lida(s)', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (7,'anon: SELECT em consent_log','permission denied',SQLERRM,SQLSTATE='42501');
  END;
  BEGIN
    PERFORM public.consent_grant('health_data','web');
    INSERT INTO public._r VALUES (8,'anon: EXECUTE consent_grant','permission denied','EXECUTOU',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (8,'anon: EXECUTE consent_grant','permission denied',SQLERRM,SQLSTATE='42501');
  END;
END $$;
RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3 — T002b/14: e se um GRANT escorregar numa migração futura? (defesa em profundidade)
-- ═══════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) TO authenticated; -- o "erro" simulado

SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.delete_user_account_by_id((SELECT v FROM public._ids WHERE k='u_b'));
    INSERT INTO public._r VALUES (14,'GRANT forçado + authenticated chama _by_id(OUTRO)','RAISE forbidden','APAGOU CONTA ALHEIA — guarda inútil',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (14,'GRANT forçado + authenticated chama _by_id(OUTRO)','RAISE forbidden',SQLERRM, SQLERRM = 'forbidden');
  END;
END $$;
RESET ROLE;
REVOKE EXECUTE ON FUNCTION public.delete_user_account_by_id(uuid) FROM authenticated; -- desfaz o "erro"

-- 15. a conta-alvo dos ataques 12/13/14 continua de pé
INSERT INTO public._r
SELECT 15,'conta-alvo (B) após os ataques 12/13/14','intacta',
       CASE WHEN count(*) = 1 THEN 'existe' ELSE 'SUMIU' END, count(*) = 1
FROM auth.users WHERE id = (SELECT v FROM public._ids WHERE k='u_b');

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4 — T008b: PO-6 (exclusão apaga tudo E deixa o recibo)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Povoa o titular A em TODAS as tabelas com user_id que aceitam fixture direta.
INSERT INTO public.user_settings (user_id) VALUES ((SELECT v FROM public._ids WHERE k='u_a'))
  ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.medicines (id, user_id, name, dosage_unit, type)
  VALUES ((SELECT v FROM public._ids WHERE k='med_a'), (SELECT v FROM public._ids WHERE k='u_a'), 'Med PO-6', 'mg', 'medicamento');
INSERT INTO public.treatment_plans (id, user_id, name)
  VALUES ((SELECT v FROM public._ids WHERE k='plan_a'), (SELECT v FROM public._ids WHERE k='u_a'), 'Plano PO-6');
-- protocolo INATIVO: o wrapper bloquearia exclusão com tratamento ativo (isso é o assert 26).
INSERT INTO public.protocols (id, user_id, medicine_id, name, start_date, active)
  VALUES ((SELECT v FROM public._ids WHERE k='prot_a'), (SELECT v FROM public._ids WHERE k='u_a'),
          (SELECT v FROM public._ids WHERE k='med_a'), 'Trat PO-6', CURRENT_DATE, false);
INSERT INTO public.medicine_logs (id, user_id, medicine_id, quantity_taken)
  VALUES ((SELECT v FROM public._ids WHERE k='log_a'), (SELECT v FROM public._ids WHERE k='u_a'),
          (SELECT v FROM public._ids WHERE k='med_a'), 1);
INSERT INTO public.stock (id, user_id, medicine_id, quantity)
  VALUES ((SELECT v FROM public._ids WHERE k='stock_a'), (SELECT v FROM public._ids WHERE k='u_a'),
          (SELECT v FROM public._ids WHERE k='med_a'), 10);
INSERT INTO public.purchases (user_id, medicine_id, quantity_bought, purchase_date)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), (SELECT v FROM public._ids WHERE k='med_a'), 10, CURRENT_DATE);
INSERT INTO public.stock_adjustments (user_id, medicine_id, quantity_delta, reason)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), (SELECT v FROM public._ids WHERE k='med_a'), 5, 'fixture PO-6');
INSERT INTO public.stock_consumptions (user_id, medicine_log_id, medicine_id, stock_id, quantity_consumed)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), (SELECT v FROM public._ids WHERE k='log_a'),
          (SELECT v FROM public._ids WHERE k='med_a'), (SELECT v FROM public._ids WHERE k='stock_a'), 1);
-- DADO SENSÍVEL (o buraco do AP-291): tem que sumir também.
INSERT INTO public.biomarkers_log (user_id, value, unit) VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 98.6, 'mg/dL');
INSERT INTO public.notification_log (user_id, notification_type) VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 'dose_reminder');
INSERT INTO public.notification_devices (user_id, app_kind, platform, provider, push_token)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 'native', 'ios', 'expo', 'ExponentPushToken[po6]');
INSERT INTO public.push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 'https://push.test/po6', 'p256dh', 'auth');
INSERT INTO public.push_notification_logs (user_id, notification_type, title, body)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 'dose_reminder', 'titulo', 'corpo');
INSERT INTO public.failed_notification_queue (user_id, correlation_id, notification_type, notification_payload)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), gen_random_uuid(), 'dose_reminder', '{}'::jsonb);
INSERT INTO public.bot_sessions (user_id, chat_id, expires_at)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 999001, now() + interval '1 day');
INSERT INTO public.gemini_reviews (user_id, pr_number, commit_sha, file_path, issue_hash)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 1, 'sha', 'f.ts', 'hash-po6');
INSERT INTO public.feedbacks (user_id, subject, comment, platform)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 'assunto', 'comentario', 'ios');
INSERT INTO public.notification_outbox (user_id, kind, period_key)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 'daily_digest', '2026-07-14');
-- 052 Slice B: `medicine_id` NOT NULL (snapshot de identidade).
INSERT INTO public.dose_instances (user_id, protocol_id, medicine_id, scheduled_for, expected_dose)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), (SELECT v FROM public._ids WHERE k='prot_a'),
          (SELECT v FROM public._ids WHERE k='med_a'), now(), 1);
INSERT INTO public.dose_critical_events (user_id, event, platform, actor)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), 'alarm_fired', 'ios', 'system');
INSERT INTO public.dose_adherence_monthly (user_id, protocol_id, month, expected, taken, missed)
  VALUES ((SELECT v FROM public._ids WHERE k='u_a'), (SELECT v FROM public._ids WHERE k='prot_a'), date_trunc('month', CURRENT_DATE)::date, 10, 8, 2);

-- Guarda o e-mail e o hash ANTES da exclusão (depois dela, não existe mais e-mail no banco).
CREATE TABLE public._before AS
SELECT u.email AS email,
       public.consent_subject_hash(u.email) AS subject_hash,
       (SELECT count(*) FROM public.consent_log c WHERE c.user_id = u.id) AS eventos
FROM auth.users u WHERE u.id = (SELECT v FROM public._ids WHERE k='u_a');

-- 26. o wrapper AINDA bloqueia exclusão com tratamento ATIVO (S1: a regra de UX não sumiu)
INSERT INTO public.protocols (id, user_id, medicine_id, name, start_date, active)
  VALUES ((SELECT v FROM public._ids WHERE k='prot_c'), (SELECT v FROM public._ids WHERE k='u_c'),
          (SELECT v FROM public._ids WHERE k='med_a'), 'Trat ATIVO', CURRENT_DATE, true);
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_c'));
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.delete_user_account();
    INSERT INTO public._r VALUES (26,'wrapper: exclusão com tratamento ATIVO','RAISE active_treatments_block','EXCLUIU — regra de UX perdida',false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public._r VALUES (26,'wrapper: exclusão com tratamento ATIVO','RAISE active_treatments_block',SQLERRM, SQLERRM = 'active_treatments_block');
  END;
END $$;
RESET ROLE;

-- A EXCLUSÃO (titular A, pelo próprio botão do app)
SELECT public._as_user((SELECT v FROM public._ids WHERE k='u_a'));
SET LOCAL ROLE authenticated;
SELECT public.delete_user_account();
RESET ROLE;

-- 21. zero linhas do titular em TODA tabela com user_id (varredura dinâmica, menos consent_log)
DO $$
DECLARE r record; v_cnt bigint; v_total bigint := 0; v_sujas text := '';
        v_uid uuid := (SELECT v FROM public._ids WHERE k='u_a');
BEGIN
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
     JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public' AND c.column_name='user_id' AND t.table_type='BASE TABLE'
      AND c.table_name NOT IN ('consent_log','_r','_ids','_before')
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', r.table_name)
      INTO v_cnt USING v_uid;
    v_total := v_total + v_cnt;
    IF v_cnt > 0 THEN v_sujas := v_sujas || r.table_name || '(' || v_cnt || ') '; END IF;
  END LOOP;
  INSERT INTO public._r VALUES (21,'linhas do titular em TODA tabela com user_id (exceto consent_log)','0',
    CASE WHEN v_total = 0 THEN '0 (varredura dinâmica, nenhuma tabela suja)' ELSE 'SOBROU: ' || v_sujas END,
    v_total = 0);
END $$;

-- 22. auth.users limpo
INSERT INTO public._r
SELECT 22,'auth.users após a exclusão','0 linhas', count(*)||' linha(s)', count(*) = 0
FROM auth.users WHERE id = (SELECT v FROM public._ids WHERE k='u_a');

-- 23. a trilha SOBREVIVEU, órfã, com o hash intacto
INSERT INTO public._r
SELECT 23,'consent_log do titular: sobreviveu órfã (user_id NULL + subject_hash)',
       (SELECT eventos+1 FROM public._before)||' linha(s), user_id NULL, hash 64 hex',
       count(*)||' linha(s), user_id NULL='||count(*) FILTER (WHERE user_id IS NULL)||', hash ok='||count(*) FILTER (WHERE subject_hash ~ '^[0-9a-f]{64}$'),
       count(*) = (SELECT eventos+1 FROM public._before)
         AND count(*) = count(*) FILTER (WHERE user_id IS NULL)
         AND count(*) = count(*) FILTER (WHERE subject_hash ~ '^[0-9a-f]{64}$')
FROM public.consent_log WHERE subject_hash = (SELECT subject_hash FROM public._before);

-- 24. O RECIBO
INSERT INTO public._r
SELECT 24,'recibo `account_deleted` na trilha','1 linha, platform=server, user_id NULL',
       count(*)||' linha(s) | policy_version='||coalesce(max(policy_version),'(NULL)')||' | platform='||coalesce(max(platform),'-'),
       count(*) = 1
FROM public.consent_log
WHERE subject_hash = (SELECT subject_hash FROM public._before) AND action = 'account_deleted';

-- 25. O REQUERIMENTO JUDICIAL: nomeiam o titular → recalculamos o HMAC → achamos as linhas.
INSERT INTO public._r
SELECT 25,'requerimento: HMAC do e-mail original reencontra a trilha','>= 2 linhas (consentimento + recibo)',
       count(*)||' linha(s) localizada(s) pelo hash recomputado', count(*) >= 2
FROM public.consent_log
WHERE subject_hash = public.consent_subject_hash((SELECT email FROM public._before));

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESULTADO
-- ═══════════════════════════════════════════════════════════════════════════════
SELECT n,
       CASE WHEN ok THEN 'PASS' ELSE '*** FAIL ***' END AS r,
       caso, esperado, obtido
FROM public._r ORDER BY n;

ROLLBACK;
