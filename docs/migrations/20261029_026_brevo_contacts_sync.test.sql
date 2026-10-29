-- Spec 026 Slice 2A — prova da migração 20261029_026_brevo_contacts_sync.sql
-- (PO-2A-2, PO-SEC-1, PO-SEC-2 + guard da 107: grants da lápide e das RPCs de prune intactos).
--
-- Execução (MCP execute_sql, QA primeiro): roda DEPOIS do corpo da migração, no MESMO script, e
-- termina com RAISE EXCEPTION 'RESULT …' — o erro final desfaz tudo (migração + sementes).
-- Qualquer asserção que falhe levanta antes, com a mensagem própria. Nada sobra no banco.

-- ─── 1. Privilégios (PO-SEC-1) + guard 107 ──────────────────────────────────────────────────
DO $$
DECLARE r text; f text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH f IN ARRAY ARRAY['public.brevo_sync_candidates(timestamptz,int)',
                             'public.brevo_mark_synced(uuid)',
                             'public.brevo_deleted_since(timestamptz)'] LOOP
      IF has_function_privilege(r, f, 'EXECUTE') THEN RAISE EXCEPTION 'PO-SEC-1: % executa %', r, f; END IF;
    END LOOP;
    -- guard 107: nada do que a 026 tocou reabriu a lápide ou as RPCs de prune
    IF has_function_privilege(r, 'public.prune_account_emails(uuid[])', 'EXECUTE')
       OR has_function_privilege(r, 'public._delete_user_account_core(uuid)', 'EXECUTE')
       OR has_table_privilege(r, 'private.account_tombstone', 'SELECT') THEN
      RAISE EXCEPTION 'guard 107: % ganhou privilégio', r;
    END IF;
  END LOOP;
  IF has_table_privilege('service_role', 'private.account_tombstone', 'SELECT') THEN
    RAISE EXCEPTION 'guard 107: service_role lê a lápide direto';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.brevo_sync_candidates(timestamptz,int)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.brevo_mark_synced(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.brevo_deleted_since(timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PO-SEC-1: service_role sem EXECUTE';
  END IF;
  -- S-2: assinatura sem e-mail
  IF pg_get_function_result('public.brevo_deleted_since(timestamptz)'::regprocedure) <> 'TABLE(user_id uuid)' THEN
    RAISE EXCEPTION 'S-2: brevo_deleted_since devolve %',
      pg_get_function_result('public.brevo_deleted_since(timestamptz)'::regprocedure);
  END IF;
END $$;

-- ─── 2. Sementes ────────────────────────────────────────────────────────────────────────────
-- a elegível · b confirmada há 30 min · c criada antes do start · d já marcada
-- e prune viva · f prune void (entra) · g sem user_settings · h sem e-mail confirmado
INSERT INTO auth.users (id, email, created_at, email_confirmed_at) VALUES
  ('02600000-0000-0000-0000-00000000000a', 't026-a@dosiq.test', now() - interval '3 hours',  now() - interval '2 hours'),
  ('02600000-0000-0000-0000-00000000000b', 't026-b@dosiq.test', now() - interval '3 hours',  now() - interval '30 minutes'),
  ('02600000-0000-0000-0000-00000000000c', 't026-c@dosiq.test', now() - interval '3 days',   now() - interval '3 days'),
  ('02600000-0000-0000-0000-00000000000d', 't026-d@dosiq.test', now() - interval '3 hours',  now() - interval '2 hours'),
  ('02600000-0000-0000-0000-00000000000e', 't026-e@dosiq.test', now() - interval '3 hours',  now() - interval '2 hours'),
  ('02600000-0000-0000-0000-00000000000f', 't026-f@dosiq.test', now() - interval '3 hours',  now() - interval '2 hours'),
  ('02600000-0000-0000-0000-000000000010', 't026-g@dosiq.test', now() - interval '3 hours',  now() - interval '2 hours'),
  ('02600000-0000-0000-0000-000000000011', 't026-h@dosiq.test', now() - interval '3 hours',  NULL);
-- user_settings nasce pelo gatilho de auth.users. Sessão MCP = postgres ⇒ o guard libera.
UPDATE public.user_settings SET brevo_synced_at = now() WHERE user_id = '02600000-0000-0000-0000-00000000000d';
DELETE FROM public.user_settings WHERE user_id = '02600000-0000-0000-0000-000000000010';
INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at, decision, void_reason) VALUES
  ('02600000-0000-0000-0000-00000000000e', 'unconfirmed_signup', now(), now() + interval '7 days', 'pending', NULL),
  ('02600000-0000-0000-0000-00000000000f', 'unconfirmed_signup', now(), now() + interval '7 days', 'void', 'granted');
INSERT INTO private.account_tombstone (user_id, email, subject_hash, deleted_at) VALUES
  ('02600000-0000-0000-0000-0000000000d1', 't026-del1@dosiq.test', 'h1', now() - interval '1 hour'),
  ('02600000-0000-0000-0000-0000000000d2', 't026-del2@dosiq.test', 'h2', now() - interval '3 days');

-- ─── 3. Titular não grava brevo_synced_at (PO-SEC-2) ────────────────────────────────────────
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"02600000-0000-0000-0000-00000000000a"}', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_n int;
BEGIN
  BEGIN
    UPDATE public.user_settings SET brevo_synced_at = now() WHERE user_id = '02600000-0000-0000-0000-00000000000a';
    RAISE EXCEPTION 'PO-SEC-2: titular gravou brevo_synced_at (UPDATE)';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'brevo_synced_at_is_controller_owned' THEN RAISE; END IF;
  END;
  -- guard: outras colunas seguem editáveis pelo titular
  UPDATE public.user_settings SET display_name = 'Teste 026' WHERE user_id = '02600000-0000-0000-0000-00000000000a';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'PO-SEC-2 guard: titular não editou display_name (%)', v_n; END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"02600000-0000-0000-0000-000000000010"}', true);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.user_settings (user_id, brevo_synced_at) VALUES ('02600000-0000-0000-0000-000000000010', now());
    RAISE EXCEPTION 'PO-SEC-2: titular gravou brevo_synced_at (INSERT)';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'brevo_synced_at_is_controller_owned' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- ─── 4. service_role: candidatas, marca e lápide (PO-2A-2) ──────────────────────────────────
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE v_got text;
BEGIN
  SELECT string_agg(right(user_id::text, 2), ',' ORDER BY user_id) INTO v_got
    FROM public.brevo_sync_candidates(now() - interval '1 day', 50)
   WHERE email LIKE 't026-%';
  IF v_got IS DISTINCT FROM '0a,0f' THEN RAISE EXCEPTION 'PO-2A-2: candidatas = % (esperado 0a,0f)', v_got; END IF;
  IF (SELECT has_app FROM public.brevo_sync_candidates(now() - interval '1 day', 50)
       WHERE user_id = '02600000-0000-0000-0000-00000000000a') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'has_app de A deveria ser false (sem aparelho)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.brevo_sync_candidates(NULL, 50)) THEN RAISE EXCEPTION 'p_since NULL devolveu linhas'; END IF;
  IF (SELECT count(*) FROM public.brevo_sync_candidates(now() - interval '1 day', 0) WHERE email LIKE 't026-%') > 1 THEN
    RAISE EXCEPTION 'p_limit 0 não grampeou em 1';
  END IF;

  IF public.brevo_mark_synced('02600000-0000-0000-0000-00000000000a') <> 1 THEN RAISE EXCEPTION 'mark A ≠ 1'; END IF;
  IF public.brevo_mark_synced('02600000-0000-0000-0000-00000000000a') <> 0 THEN RAISE EXCEPTION 'mark A 2ª ≠ 0'; END IF;
  IF public.brevo_mark_synced('02600000-0000-0000-0000-000000000010') <> -1 THEN RAISE EXCEPTION 'mark G (sem user_settings) ≠ -1'; END IF;
  IF EXISTS (SELECT 1 FROM public.brevo_sync_candidates(now() - interval '1 day', 50)
              WHERE user_id = '02600000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'A marcada continua candidata';
  END IF;

  SELECT string_agg(right(user_id::text, 2), ',') INTO v_got
    FROM public.brevo_deleted_since(now() - interval '48 hours')
   WHERE user_id::text LIKE '02600000-%';
  IF v_got IS DISTINCT FROM 'd1' THEN RAISE EXCEPTION 'lápide 48 h = % (esperado d1)', v_got; END IF;
  IF EXISTS (SELECT 1 FROM public.brevo_deleted_since(NULL)) THEN RAISE EXCEPTION 'lápide p_since NULL devolveu linhas'; END IF;
END $$;

-- ─── 5. Fora do service_role a RPC recusa mesmo com EXECUTE (defesa em profundidade) ───────
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
DO $$
BEGIN
  BEGIN PERFORM public.brevo_mark_synced('02600000-0000-0000-0000-00000000000f'); RAISE EXCEPTION 'mark sem service_role passou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'forbidden' THEN RAISE; END IF; END;
END $$;

DO $$ BEGIN RAISE EXCEPTION 'RESULT 026-2A: todas as asserções PASS (rollback intencional)'; END $$;
