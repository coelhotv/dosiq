-- Spec 107 — prova da migração 20261020_107_prune_queue.sql (CP-2: PO-SEC-4, PO-SEC-7, PO-SEC-8,
-- PO-9, parte SQL de PO-3/PO-5/PO-SEC-3).
--
-- Execução (MCP execute_sql): este arquivo roda DEPOIS do corpo da migração, no MESMO script, e
-- termina com RAISE EXCEPTION 'RESULT …' — o erro final desfaz tudo (migração + sementes). Qualquer
-- asserção que falhe levanta antes, com a mensagem própria. Nada sobra no banco.
--
-- Antes de rodar: capturar o corpo ANTIGO do core em _t107_old_core (ver bloco 0), senão o S-9 não
-- tem contra o que comparar. O script de execução faz isso antes de aplicar a migração.

-- ─── 0. S-9 / PO-SEC-7: corpo novo contém todo o corpo antigo + só a lápide ─────────────────
DO $$
DECLARE v_old text := current_setting('t107.old_core'); v_new text; v_line text;
BEGIN
  v_new := pg_get_functiondef('public._delete_user_account_core'::regproc);
  FOR v_line IN SELECT btrim(l) FROM regexp_split_to_table(v_old, E'\n') l
                 WHERE l ~ '(DELETE FROM|set_config|account_deleted)' LOOP
    IF position(v_line IN v_new) = 0 THEN RAISE EXCEPTION 'S-9: linha do corpo antigo sumiu: %', v_line; END IF;
  END LOOP;
  IF position('private.account_tombstone' IN v_new) = 0 THEN RAISE EXCEPTION 'S-9: lápide ausente'; END IF;
  IF (SELECT count(*) FROM regexp_matches(v_new, 'DELETE FROM', 'g'))
     <> (SELECT count(*) FROM regexp_matches(v_old, 'DELETE FROM', 'g')) THEN
    RAISE EXCEPTION 'S-9: número de DELETE mudou';
  END IF;
END $$;

-- ─── 1. Privilégios (PO-SEC-4, PO-SEC-8, PO-SEC-7 ACL) ──────────────────────────────────────
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(r, 'public.prune_queue', 'SELECT') OR has_table_privilege(r, 'public.prune_queue', 'INSERT')
       OR has_table_privilege(r, 'public.prune_queue_audit', 'SELECT')
       OR has_table_privilege(r, 'public.consent_copy', 'INSERT') OR has_table_privilege(r, 'public.consent_copy', 'UPDATE')
       OR has_table_privilege(r, 'public.consent_copy_history', 'SELECT')
       OR has_function_privilege(r, 'public.prune_unconsented_accounts()', 'EXECUTE')
       OR has_function_privilege(r, 'public.prune_account_emails(uuid[])', 'EXECUTE')
       OR has_function_privilege(r, 'public.delete_user_account_by_id(uuid)', 'EXECUTE')
       OR has_function_privilege(r, 'public._delete_user_account_core(uuid)', 'EXECUTE') THEN
      RAISE EXCEPTION 'PO-SEC-4: % tem privilégio indevido', r;
    END IF;
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator'] LOOP
    IF has_schema_privilege(r, 'private', 'USAGE') THEN RAISE EXCEPTION 'PO-SEC-8: % tem USAGE em private', r; END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public.get_my_deletion_notice()', 'EXECUTE') THEN RAISE EXCEPTION 'PO-SEC-4: anon executa get_my_deletion_notice'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_my_deletion_notice()', 'EXECUTE') THEN RAISE EXCEPTION 'get_my_deletion_notice sem EXECUTE p/ authenticated'; END IF;
  IF NOT has_table_privilege('authenticated', 'public.consent_copy', 'SELECT') THEN RAISE EXCEPTION 'consent_copy sem SELECT p/ authenticated'; END IF;
  IF NOT has_table_privilege('service_role', 'public.prune_queue', 'UPDATE') THEN RAISE EXCEPTION 'service_role sem UPDATE na fila'; END IF;
END $$;

-- ─── 2. Sementes ────────────────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email, created_at) VALUES
  ('10700000-0000-0000-0000-00000000000a', 't107-a@dosiq.test', now() - interval '200 days'),
  ('10700000-0000-0000-0000-00000000000b', 't107-b@dosiq.test', now() - interval '10 days');
-- user_settings nasce pelo gatilho de auth.users (23505 se inserida à mão).
INSERT INTO public.medicines (user_id, name) VALUES ('10700000-0000-0000-0000-00000000000a', 't107 remédio');
INSERT INTO private.access_log (user_id, ip, hour_bucket, first_seen, source)
  VALUES ('10700000-0000-0000-0000-00000000000a', '203.0.113.7', date_trunc('hour', now() - interval '3 days'), now() - interval '3 days', 'data_api');

-- ─── 3. CHECKs da fila e do texto ───────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at) VALUES (gen_random_uuid(), 'foo', now(), now() + interval '90 days');
    RAISE EXCEPTION 'reason inválido aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at) VALUES (gen_random_uuid(), 'revoked_90d', now(), NULL);
    RAISE EXCEPTION 'eligible_at NULL aceito';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at, decision, decided_at, decided_by, note, reevaluate_at)
      VALUES (gen_random_uuid(), 'revoked_90d', now(), now() + interval '90 days', 'deferred', now(), gen_random_uuid(), '   ', now());
    RAISE EXCEPTION 'defer com nota em branco aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at, decision)
      VALUES (gen_random_uuid(), 'revoked_90d', now(), now() + interval '90 days', 'approved');
    RAISE EXCEPTION 'approved sem decided_by aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- unique parcial: void não bloqueia nova linha viva; 2 vivas bloqueia
  INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at, decision, void_reason)
    VALUES ('10700000-0000-0000-0000-00000000000b', 'onboarding_no_consent', now(), now() + interval '90 days', 'void', 'granted');
  INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at)
    VALUES ('10700000-0000-0000-0000-00000000000b', 'onboarding_no_consent', now(), now() + interval '90 days');
  BEGIN
    INSERT INTO public.prune_queue (user_id, reason, scheduled_at, eligible_at)
      VALUES ('10700000-0000-0000-0000-00000000000b', 'onboarding_no_consent', now(), now() + interval '90 days');
    RAISE EXCEPTION '2ª linha viva aceita';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- consent_copy: sem {data}, {data} 2×, curto
  BEGIN UPDATE public.consent_copy SET body = repeat('x', 30) WHERE key = 'never_consented_deadline'; RAISE EXCEPTION 'texto sem {data} aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE public.consent_copy SET body = 'em {data} e {data} xxxxxxxxxxxxx' WHERE key = 'never_consented_deadline'; RAISE EXCEPTION '{data} duplicado aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE public.consent_copy SET body = '{data}' WHERE key = 'never_consented_deadline'; RAISE EXCEPTION 'texto curto aceito';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- ─── 4. Papéis: authenticated lê o texto e só a própria data; não chama RPC service ─────────
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"10700000-0000-0000-0000-00000000000b"}', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.consent_copy) <> 1 THEN RAISE EXCEPTION 'authenticated não lê consent_copy'; END IF;
  IF public.get_my_deletion_notice() IS NULL THEN RAISE EXCEPTION 'B não vê a própria data'; END IF;
  BEGIN PERFORM public.prune_unconsented_accounts(); RAISE EXCEPTION 'authenticated chamou RPC service';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.prune_queue; RAISE EXCEPTION 'authenticated leu a fila';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"10700000-0000-0000-0000-00000000000a"}', true);
DO $$
BEGIN
  IF public.get_my_deletion_notice() IS NOT NULL THEN RAISE EXCEPTION 'A viu data que não é dele'; END IF;
END $$;
RESET ROLE;

-- ─── 5. service_role: scheduled_deletion, RPCs e exclusão com lápide (PO-5, PO-9) ──────────
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
DO $$
DECLARE v_hash text; v_email text;
BEGIN
  PERFORM public.consent_controller_event('10700000-0000-0000-0000-00000000000a', 'scheduled_deletion', 'health_data');
  IF NOT EXISTS (SELECT 1 FROM public.consent_log WHERE user_id = '10700000-0000-0000-0000-00000000000a' AND action = 'scheduled_deletion') THEN
    RAISE EXCEPTION 'PO-5: scheduled_deletion não gravado';
  END IF;
  BEGIN PERFORM public.consent_controller_event('10700000-0000-0000-0000-00000000000a', 'revoked', 'health_data');
    RAISE EXCEPTION 'INV-3: controlador gravou revoked';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'consent_action_not_allowed' THEN RAISE; END IF; END;

  IF NOT EXISTS (SELECT 1 FROM public.prune_unconsented_accounts() WHERE user_id = '10700000-0000-0000-0000-00000000000a') THEN
    RAISE EXCEPTION 'conta sem granted fora de prune_unconsented_accounts';
  END IF;
  SELECT email INTO v_email FROM public.prune_account_emails(ARRAY['10700000-0000-0000-0000-00000000000a'::uuid]);
  IF v_email <> 't107-a@dosiq.test' THEN RAISE EXCEPTION 'prune_account_emails errado'; END IF;

  PERFORM public.delete_user_account_by_id('10700000-0000-0000-0000-00000000000a');

  IF EXISTS (SELECT 1 FROM public.medicines WHERE user_id = '10700000-0000-0000-0000-00000000000a') THEN RAISE EXCEPTION 'PO-9: dado de saúde restou'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '10700000-0000-0000-0000-00000000000a') THEN RAISE EXCEPTION 'conta não apagada'; END IF;
  SELECT t.email, t.subject_hash INTO v_email, v_hash FROM private.account_tombstone t WHERE t.user_id = '10700000-0000-0000-0000-00000000000a';
  IF v_email IS DISTINCT FROM 't107-a@dosiq.test' THEN RAISE EXCEPTION 'PO-9: lápide sem e-mail'; END IF;
  -- vínculo IP → e-mail após a exclusão (o ofício)
  IF NOT EXISTS (SELECT 1 FROM private.access_log l JOIN private.account_tombstone t USING (user_id)
                  WHERE host(l.ip) = '203.0.113.7' AND t.email = 't107-a@dosiq.test') THEN
    RAISE EXCEPTION 'PO-9: IP não resolve para o e-mail';
  END IF;
  -- trilha correlacionável pelo hash (G-1b): account_deleted com o mesmo subject_hash
  IF NOT EXISTS (SELECT 1 FROM public.consent_log WHERE subject_hash = v_hash AND action = 'account_deleted') THEN
    RAISE EXCEPTION 'PO-3: trilha não correlaciona pelo hash';
  END IF;
END $$;

-- ─── 6. Purga: fronteira de 6 meses (PO-9) ──────────────────────────────────────────────────
INSERT INTO private.account_tombstone (user_id, email, subject_hash, deleted_at) VALUES
  ('10700000-0000-0000-0000-0000000000c1', 'velho@dosiq.test', 'h1', now() - interval '6 months' - interval '1 day'),
  ('10700000-0000-0000-0000-0000000000c2', 'novo@dosiq.test',  'h2', now() - interval '6 months' + interval '1 day');
SELECT private.purge_access_log();
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM private.account_tombstone WHERE user_id = '10700000-0000-0000-0000-0000000000c1') THEN RAISE EXCEPTION 'PO-9: lápide vencida não purgada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.account_tombstone WHERE user_id = '10700000-0000-0000-0000-0000000000c2') THEN RAISE EXCEPTION 'PO-9: lápide no prazo purgada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM private.account_tombstone WHERE user_id = '10700000-0000-0000-0000-00000000000a') THEN RAISE EXCEPTION 'PO-9: lápide recente purgada'; END IF;
END $$;

DO $$ BEGIN RAISE EXCEPTION 'RESULT 107: todas as asserções PASS (rollback intencional)'; END $$;
