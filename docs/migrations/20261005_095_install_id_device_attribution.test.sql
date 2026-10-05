-- 20261005_095_install_id_device_attribution.test.sql — spec 095 / T003
--
-- Validação por FAILURE MODE (R-270). Rodar: conteúdo da migração + ESTE arquivo numa única
-- execução. Cada bloco faz asserções que abortam com 'FALHA <bloco>: …'; o RAISE final aborta com
-- 'TESTE 095 OK' — a transação inteira volta, nada persiste (nem a migração, no dry-run).
-- Pós-aplicação: rodar só este arquivo (sem a migração) — mesmo resultado esperado.
--
-- Usuários: 3 contas reais de auth.users (FK). A chamada às RPCs roda como `authenticated` com
-- `request.jwt.claims` do usuário (auth.uid() real — PO-SEC-1: nunca service_role). As asserções
-- leem como o papel do teste (RESET ROLE).
-- Identificadores do teste: fingerprints '095:*', tokens 'T095:*' — nada colide com dado real.
--
-- Blocos:
--   1. PO-1      token A→B apaga só a linha fp+versão de A; C e outras linhas de A intactas
--   2. PO-2      adoção da linha legada; controle com outro fingerprint
--   3. PO-3      2 instalações = 2 linhas; SO atualizado com mesmo id = mesma linha
--   4. PO-6 / PO-SEC-4  FR-009: rotação desativa o anterior; outro canal/conta/id intactos; reativação
--   5. guard     caminhos atuais do registro de push (novo, mesmo dono, reativação, webpush)
--   6. PO-SEC-1  X com id/fp/token de Y não altera Y (exceto FR-001 com token real)
--   7. PO-SEC-3  id inválido / 10 kB ⇒ 22P02 sem escrita
--   8. ADR-088   assinaturas antigas (3, 7 e 8 params nomeados) + anon sem EXECUTE

CREATE TEMP TABLE t095_users ON COMMIT DROP AS
  SELECT id, row_number() OVER (ORDER BY created_at) AS n
    FROM (SELECT id, created_at FROM auth.users ORDER BY created_at LIMIT 3) u;
GRANT SELECT ON t095_users TO authenticated;

CREATE FUNCTION pg_temp.u(k int) RETURNS uuid LANGUAGE sql AS $$ SELECT id FROM t095_users WHERE n = k $$;

-- ═══ Bloco 1 — PO-1 ══════════════════════════════════════════════════════════
DO $$
DECLARE a uuid := pg_temp.u(1); b uuid := pg_temp.u(2); c uuid := pg_temp.u(3); n int;
BEGIN
  -- A: app antigo com push (token T1, fp 095:F1, 0.30.0) + heartbeat; outra linha de A (095:F1b);
  -- linha de A com versão diferente da do token T2 (app atualizado entre um e outro).
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_notification_device('expo', 'T095:1', 'ios', 'native', 'x', '095:F1', '0.30.0');
  PERFORM public.upsert_device_activity('095:F1', 'ios', '0.30.0');
  PERFORM public.upsert_device_activity('095:F1b', 'ios', '0.30.0');
  PERFORM public.upsert_notification_device('expo', 'T095:2', 'ios', 'native', 'x', '095:F2', '0.30.0');
  PERFORM public.upsert_device_activity('095:F2', 'ios', '0.31.0');
  -- C: outra pessoa, mesmo modelo/iOS/versão
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM public.upsert_device_activity('095:F1', 'ios', '0.30.0');
  -- O app antigo troca para B (os dois tokens mudam de dono)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.upsert_notification_device('expo', 'T095:1', 'ios', 'native', 'x', '095:F1', '0.30.0');
  PERFORM public.upsert_notification_device('expo', 'T095:2', 'ios', 'native', 'x', '095:F2', '0.30.0');
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = a AND device_fingerprint = '095:F1';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA 1: linha fp+versão de A não foi apagada (%)', n; END IF;
  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = a AND device_fingerprint = '095:F1b';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 1: outra linha de A afetada'; END IF;
  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = a AND device_fingerprint = '095:F2';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 1: linha de versão diferente apagada'; END IF;
  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = c AND device_fingerprint = '095:F1';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 1: linha de C (mesmo fp/versão) afetada — SC-002'; END IF;
  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = b AND device_fingerprint LIKE '095:%';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHA 1: efeito colateral em B'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:1' AND user_id = b AND is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 1: reatribuição do token quebrou'; END IF;
  RAISE NOTICE 'bloco 1 ok';
END $$;

-- ═══ Bloco 2 — PO-2 ══════════════════════════════════════════════════════════
DO $$
DECLARE a uuid := pg_temp.u(1); i uuid := gen_random_uuid(); n int; v text; got uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_device_activity('095:G1', 'ios', '0.30.0');
  PERFORM public.upsert_device_activity('095:G2', 'ios', '0.30.0');
  PERFORM public.upsert_device_activity('095:G1', 'ios', '0.34.0', i);
  EXECUTE 'RESET ROLE';

  SELECT count(*), max(app_version), max(install_id::text)::uuid INTO n, v, got
    FROM public.device_activity WHERE user_id = a AND device_fingerprint = '095:G1';
  IF n <> 1 OR v <> '0.34.0' OR got IS DISTINCT FROM i THEN
    RAISE EXCEPTION 'FALHA 2: adoção (linhas=%, versão=%, id=%)', n, v, got;
  END IF;
  SELECT count(*) INTO n FROM public.device_activity
   WHERE user_id = a AND device_fingerprint = '095:G2' AND install_id IS NULL AND app_version = '0.30.0';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 2: controle de outro fingerprint afetado'; END IF;
  RAISE NOTICE 'bloco 2 ok';
END $$;

-- ═══ Bloco 3 — PO-3 ══════════════════════════════════════════════════════════
DO $$
DECLARE a uuid := pg_temp.u(1); i1 uuid := gen_random_uuid(); i2 uuid := gen_random_uuid(); n int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_device_activity('095:H1', 'ios', '0.34.0', i1);  -- dosiqdev
  PERFORM public.upsert_device_activity('095:H1', 'ios', '0.33.3', i2);  -- outro app, mesmo aparelho
  PERFORM public.upsert_device_activity('095:H1-novo-ios', 'ios', '0.34.0', i1);  -- SO atualizado
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = a AND install_id IN (i1, i2);
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA 3: esperava 2 linhas por instalação, há %', n; END IF;
  SELECT count(*) INTO n FROM public.device_activity
   WHERE user_id = a AND install_id = i1 AND device_fingerprint = '095:H1-novo-ios';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 3: SO atualizado não seguiu a linha da instalação'; END IF;
  RAISE NOTICE 'bloco 3 ok';
END $$;

-- ═══ Bloco 4 — PO-6 / PO-SEC-4 (FR-009) ═════════════════════════════════════
DO $$
DECLARE a uuid := pg_temp.u(1); c uuid := pg_temp.u(3); i1 uuid := gen_random_uuid(); n int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_notification_device('expo', 'T095:C', 'ios', 'native', 'x', '095:K', '0.30.0');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  -- C-5: token velho LA 0.30.0 (sem id) + token com id (instalação nova) + token de outro canal
  PERFORM public.upsert_notification_device('apns_liveactivity', 'T095:LA-old', 'ios', 'native', 'x', '095:K', '0.30.0');
  PERFORM public.upsert_notification_device('expo', 'T095:A-id', 'ios', 'native', 'x', '095:K', '0.34.0', false, i1);
  PERFORM public.upsert_notification_device('expo', 'T095:B-legacy', 'ios', 'native', 'x', '095:K', '0.30.0');
  -- PO-SEC-4: registro de token novo SEM id ⇒ só desativa linhas sem id do mesmo fp
  PERFORM public.upsert_notification_device('expo', 'T095:N', 'ios', 'native', 'x', '095:K', '0.30.0');
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:B-legacy' AND NOT is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: token legado anterior não foi desativado'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:A-id' AND is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: fallback atingiu linha com id (PO-SEC-4)'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:LA-old' AND is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: outro canal afetado'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:C' AND is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: outra conta afetada'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- C-5 LA: token novo LA COM id desativa o LA velho sem id do mesmo fp
  PERFORM public.upsert_notification_device('apns_liveactivity', 'T095:LA-new', 'ios', 'native', 'x', '095:K', '0.34.0', false, i1);
  -- mesma instalação após atualizar o SO (fp novo): token rotacionado com o mesmo id
  PERFORM public.upsert_notification_device('expo', 'T095:A-id2', 'ios', 'native', 'x', '095:K-novo-ios', '0.34.0', false, i1);
  -- S-2: app antigo re-registra o próprio token ⇒ volta a ativo
  PERFORM public.upsert_notification_device('expo', 'T095:B-legacy', 'ios', 'native', 'x', '095:K', '0.30.0');
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:LA-old' AND NOT is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: LA rotacionado ficou ativo (C-5)'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:A-id' AND NOT is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: token anterior da mesma instalação ficou ativo'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:B-legacy' AND is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: re-registro não reativou (S-2)'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token = 'T095:C' AND is_active;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 4: outra conta afetada (2)'; END IF;
  RAISE NOTICE 'bloco 4 ok';
END $$;

-- ═══ Bloco 5 — guard: caminhos atuais do registro de push ═══════════════════
DO $$
DECLARE a uuid := pg_temp.u(1); b uuid := pg_temp.u(2); n int; r record;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_notification_device('expo', 'T095:G', 'android', 'native', 'Pixel', '095:L', '0.33.0', true);
  PERFORM public.upsert_device_activity('095:L', 'android', '0.33.0');
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.notification_devices WHERE push_token = 'T095:G';
  IF r.user_id <> a OR NOT r.is_active OR r.platform <> 'android' OR r.device_name <> 'Pixel'
     OR r.app_version <> '0.33.0' OR NOT r.native_alarm_enabled OR r.install_id IS NOT NULL THEN
    RAISE EXCEPTION 'FALHA 5: token novo gravou diferente';
  END IF;

  -- reativação pelo mesmo dono (logout desativou) não apaga atividade dele
  UPDATE public.notification_devices SET is_active = false WHERE push_token = 'T095:G';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_notification_device('expo', 'T095:G', 'android', 'native', 'Pixel', '095:L', '0.33.0', false);
  EXECUTE 'RESET ROLE';
  SELECT * INTO r FROM public.notification_devices WHERE push_token = 'T095:G';
  IF NOT r.is_active OR r.native_alarm_enabled THEN RAISE EXCEPTION 'FALHA 5: reativação'; END IF;
  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = a AND device_fingerprint = '095:L';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 5: mesmo dono apagou a própria atividade'; END IF;

  -- webpush pela RPC: reatribui e NÃO desativa outro webpush da conta
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_notification_device('webpush', 'T095:W1', 'web', 'pwa', 'Chrome', '095:W', NULL);
  PERFORM public.upsert_notification_device('webpush', 'T095:W2', 'web', 'pwa', 'Chrome', '095:W', NULL);
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token IN ('T095:W1', 'T095:W2') AND is_active AND user_id = b;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA 5: webpush afetado por FR-009'; END IF;
  RAISE NOTICE 'bloco 5 ok';
END $$;

-- ═══ Bloco 6 — PO-SEC-1 ══════════════════════════════════════════════════════
DO $$
DECLARE x uuid := pg_temp.u(2); y uuid := pg_temp.u(3); iy uuid := gen_random_uuid();
        before_a text; after_a text; before_n text; after_n text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_device_activity('095:Y', 'ios', '0.30.0', iy);
  PERFORM public.upsert_device_activity('095:Y-legacy', 'ios', '0.30.0');
  PERFORM public.upsert_notification_device('expo', 'T095:Y', 'ios', 'native', 'x', '095:Y', '0.30.0', false, iy);
  PERFORM public.upsert_notification_device('expo', 'T095:Y-legacy', 'ios', 'native', 'x', '095:Y-legacy', '0.30.0');
  EXECUTE 'RESET ROLE';
  SELECT string_agg(md5(t::text), ',' ORDER BY t.id) INTO before_a FROM public.device_activity t WHERE user_id = y;
  SELECT string_agg(md5(t::text), ',' ORDER BY t.id) INTO before_n FROM public.notification_devices t WHERE user_id = y;

  -- X tenta com o id, o fingerprint e a versão de Y — sem o token de Y
  PERFORM set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.upsert_device_activity('095:Y', 'ios', '0.30.0', iy);
  PERFORM public.upsert_device_activity('095:Y-legacy', 'ios', '0.34.0', gen_random_uuid());
  PERFORM public.delete_device_activity(iy);
  PERFORM public.upsert_notification_device('expo', 'T095:X', 'ios', 'native', 'x', '095:Y', '0.30.0', false, iy);
  PERFORM public.upsert_notification_device('expo', 'T095:X2', 'ios', 'native', 'x', '095:Y-legacy', '0.30.0');
  EXECUTE 'RESET ROLE';
  SELECT string_agg(md5(t::text), ',' ORDER BY t.id) INTO after_a FROM public.device_activity t WHERE user_id = y;
  SELECT string_agg(md5(t::text), ',' ORDER BY t.id) INTO after_n FROM public.notification_devices t WHERE user_id = y;
  IF before_a IS DISTINCT FROM after_a THEN RAISE EXCEPTION 'FALHA 6: atividade de Y alterada por X'; END IF;
  IF before_n IS DISTINCT FROM after_n THEN RAISE EXCEPTION 'FALHA 6: tokens de Y alterados por X'; END IF;
  RAISE NOTICE 'bloco 6 ok';
END $$;

-- ═══ Bloco 7 — PO-SEC-3 ══════════════════════════════════════════════════════
DO $$
DECLARE a uuid := pg_temp.u(1); n0 int; n1 int; st text;
BEGIN
  SELECT count(*) INTO n0 FROM public.device_activity WHERE user_id = a;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    EXECUTE $q$ SELECT public.upsert_device_activity('095:Z', 'ios', '0.34.0', p_install_id => 'nao-e-uuid') $q$;
    st := 'sem erro';
  EXCEPTION WHEN OTHERS THEN st := SQLSTATE;
  END;
  IF st <> '22P02' THEN RAISE EXCEPTION 'FALHA 7: id inválido ⇒ % (esperado 22P02)', st; END IF;
  BEGIN
    EXECUTE format('SELECT public.upsert_device_activity(%L, %L, %L, p_install_id => %L)', '095:Z', 'ios', '0.34.0', repeat('a', 10240));
    st := 'sem erro';
  EXCEPTION WHEN OTHERS THEN st := SQLSTATE;
  END;
  IF st <> '22P02' THEN RAISE EXCEPTION 'FALHA 7: 10 kB ⇒ % (esperado 22P02)', st; END IF;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n1 FROM public.device_activity WHERE user_id = a;
  IF n0 <> n1 THEN RAISE EXCEPTION 'FALHA 7: houve escrita'; END IF;
  RAISE NOTICE 'bloco 7 ok';
END $$;

-- ═══ Bloco 8 — assinaturas antigas + anon ═══════════════════════════════════
DO $$
DECLARE a uuid := pg_temp.u(1); n int; st text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- app 0.30.0: 3 nomeados (heartbeat), 8 e 7 nomeados (registro)
  PERFORM public.upsert_device_activity(p_device_fingerprint => '095:M', p_platform => 'ios', p_app_version => '0.30.0');
  PERFORM public.upsert_notification_device(p_provider => 'expo', p_push_token => 'T095:M8', p_platform => 'ios',
    p_app_kind => 'native', p_device_name => 'x', p_device_fingerprint => '095:M', p_app_version => '0.30.0',
    p_native_alarm_enabled => false);
  PERFORM public.upsert_notification_device(p_provider => 'expo', p_push_token => 'T095:M7', p_platform => 'ios',
    p_app_kind => 'native', p_device_name => 'x', p_device_fingerprint => '095:M2', p_app_version => '0.30.0');
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.device_activity WHERE user_id = a AND device_fingerprint = '095:M' AND install_id IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHA 8: heartbeat antigo'; END IF;
  SELECT count(*) INTO n FROM public.notification_devices WHERE push_token IN ('T095:M8', 'T095:M7');
  IF n <> 2 THEN RAISE EXCEPTION 'FALHA 8: registro antigo'; END IF;
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
   WHERE s.nspname = 'public' AND p.proname IN ('upsert_device_activity', 'upsert_notification_device', 'delete_device_activity');
  IF n <> 3 THEN RAISE EXCEPTION 'FALHA 8: sobrecarga (% funções)', n; END IF;

  EXECUTE 'SET LOCAL ROLE anon';
  BEGIN
    PERFORM public.upsert_device_activity('095:anon', 'ios', '0.34.0');
    st := 'sem erro';
  EXCEPTION WHEN OTHERS THEN st := SQLSTATE;
  END;
  EXECUTE 'RESET ROLE';
  IF st <> '42501' THEN RAISE EXCEPTION 'FALHA 8: anon executou (%)', st; END IF;
  RAISE NOTICE 'bloco 8 ok';
END $$;

DO $$ BEGIN RAISE EXCEPTION 'TESTE 095 OK — 8 blocos verdes (rollback proposital)'; END $$;
