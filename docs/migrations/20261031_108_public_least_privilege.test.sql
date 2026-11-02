-- Spec 108 Slice A — prova da migração 20261031_108_public_least_privilege.sql
-- (PO-2, PO-5, PO-9 bloco SQL, PO-10, PO-SEC-1, PO-SEC-3; PO-SEC-2 está nos pós-checks da migração).
-- Roda DEPOIS do corpo da migração (sem BEGIN/COMMIT), no MESMO script, e termina com
-- RAISE EXCEPTION 'RESULT …' — o erro final desfaz tudo. Asserção que falha levanta antes.
-- Só QA (CON-044): cria usuário fictício em auth.users.

-- ─── 0. Bloco padrão FR-014 (copiar em toda migração — SUPABASE_MIGRATIONS.md) ──────────────
DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'access_hook.capture_access()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'access_hook.capture_access()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FR-014: capture_access sem EXECUTE para anon/authenticated'; END IF;
  IF NOT has_column_privilege('anon', 'public.app_version_gate', 'min_supported_version', 'SELECT') THEN
    RAISE EXCEPTION 'FR-014: anon não lê app_version_gate'; END IF;
END $$;

-- ─── 1. PO-SEC-3: objeto criado depois nasce fechado (tabela, sequência, função) ────────────
CREATE TABLE public._t108_probe (id int);
CREATE SEQUENCE public._s108_probe;
CREATE FUNCTION public._f108_probe() RETURNS int LANGUAGE sql AS 'SELECT 1';
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_table_privilege(r, 'public._t108_probe', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') THEN
      RAISE EXCEPTION 'PO-SEC-3: tabela nova aberta a %', r; END IF;
    IF has_sequence_privilege(r, 'public._s108_probe', 'USAGE,SELECT,UPDATE') THEN
      RAISE EXCEPTION 'PO-SEC-3: sequência nova aberta a %', r; END IF;
    IF has_function_privilege(r, 'public._f108_probe()', 'EXECUTE') THEN
      RAISE EXCEPTION 'PO-SEC-3: função nova executável por %', r; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              WHERE p.oid = 'public._f108_probe()'::regprocedure AND a.grantee = 0) THEN
    RAISE EXCEPTION 'PO-SEC-3: função nova com EXECUTE a PUBLIC (A′ virou no-op)'; END IF;
END $$;

-- ─── 2. PO-10: extensões e default de coluna intactos ───────────────────────────────────────
CREATE FUNCTION extensions._f108_probe() RETURNS int LANGUAGE sql AS 'SELECT 1';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                  WHERE p.oid = 'extensions._f108_probe()'::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'PO-10: função nova em extensions sem EXECUTE a PUBLIC'; END IF;
END $$;

-- ─── 3. Usuário fictício com dado em toda tabela restante com user_id ───────────────────────
-- handle_new_user_settings cria a linha de user_settings.
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('10800000-0000-4000-8000-000000000108', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'spec108.probe@example.invalid', now(), now());

-- PO-10 (continuação): INSERT como authenticated em tabela com default uuid_generate_v4().
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"10800000-0000-4000-8000-000000000108","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.treatment_plans (name, user_id) VALUES ('probe 108', '10800000-0000-4000-8000-000000000108');
  RESET ROLE;
END $$;

DO $$
DECLARE u constant uuid := '10800000-0000-4000-8000-000000000108';
        m uuid; p uuid; l uuid; s uuid; t uuid;
BEGIN
  INSERT INTO public.medicines (user_id, name) VALUES (u, 'probe 108') RETURNING id INTO m;
  INSERT INTO public.protocols (user_id, medicine_id, name, start_date, frequency)
  VALUES (u, m, 'probe 108', current_date, 'diário') RETURNING id INTO p;
  INSERT INTO public.medicine_logs (user_id, medicine_id, protocol_id, quantity_taken) VALUES (u, m, p, 1) RETURNING id INTO l;
  INSERT INTO public.stock (user_id, medicine_id, quantity) VALUES (u, m, 10) RETURNING id INTO s;
  INSERT INTO public.stock_consumptions (user_id, medicine_log_id, medicine_id, stock_id, quantity_consumed) VALUES (u, l, m, s, 1);
  INSERT INTO public.stock_adjustments (user_id, medicine_id, quantity_delta, reason) VALUES (u, m, 1, 'probe');
  INSERT INTO public.purchases (user_id, medicine_id, quantity_bought, purchase_date) VALUES (u, m, 10, current_date);
  INSERT INTO public.dose_instances (user_id, protocol_id, medicine_id, scheduled_for, expected_dose) VALUES (u, p, m, now(), 1);
  INSERT INTO public.titrations (user_id) VALUES (u) RETURNING id INTO t;
  INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit) VALUES (t, u, 0, m, 1, 'mg');
  INSERT INTO public.biomarkers_log (user_id, value, unit) VALUES (u, 1, 'kg');
  INSERT INTO public.bot_sessions (user_id, chat_id, expires_at) VALUES (u, 108108108, now() + interval '1 hour');
  INSERT INTO public.device_activity (user_id, device_fingerprint, platform, app_version) VALUES (u, 'probe108', 'ios', '0.0.0');
  INSERT INTO public.dose_critical_events (user_id, event, platform, actor) VALUES (u, 'resolved', 'server', 'server');
  INSERT INTO public.failed_notification_queue (user_id, correlation_id, notification_type, notification_payload)
  VALUES (u, gen_random_uuid(), 'probe', '{}'::jsonb);
  INSERT INTO public.feedbacks (user_id, subject, comment, platform) VALUES (u, 'probe', 'probe', 'other');
  INSERT INTO public.notification_devices (user_id, app_kind, platform, provider, push_token) VALUES (u, 'native', 'ios', 'expo', 'probe108');
  INSERT INTO public.notification_log (user_id, notification_type) VALUES (u, 'probe');
  INSERT INTO public.notification_outbox (user_id, kind, period_key) VALUES (u, 'daily_digest', 'probe108');
  -- consent_log_consent_requires_version: granted exige policy_version.
  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (u, public.consent_subject_hash('spec108.probe@example.invalid'), 'health_data', 'granted', 'probe-108', 'server');
END $$;

-- ─── 4. PO-SEC-1: anon e authenticated bloqueados POR PRIVILÉGIO (não por RLS) ──────────────
DO $$
DECLARE t text; op text; blocked int := 0; total int := 0; v_sql text;
  regulated constant text[] := ARRAY['medicines','protocols','medicine_logs','dose_instances','stock','stock_adjustments',
    'stock_consumptions','purchases','treatment_plans','dose_critical_events','biomarkers_log','titrations','titration_steps',
    'user_settings','notification_devices','notification_log','failed_notification_queue','in_app_nudges','device_activity'];
BEGIN
  -- anon: SELECT/INSERT/UPDATE/DELETE/TRUNCATE em cada tabela regulada → 42501
  SET LOCAL ROLE anon;
  FOREACH t IN ARRAY regulated LOOP
    FOREACH op IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'] LOOP
      total := total + 1;
      v_sql := CASE op
        WHEN 'SELECT'   THEN format('SELECT 1 FROM public.%I LIMIT 1', t)
        WHEN 'INSERT'   THEN format('INSERT INTO public.%I DEFAULT VALUES', t)
        WHEN 'UPDATE'   THEN format('UPDATE public.%I SET %2$I = %2$I WHERE false', t,
                               (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = ('public.' || t)::regclass
                                   AND a.attnum = 1))
        WHEN 'DELETE'   THEN format('DELETE FROM public.%I WHERE false', t)
        WHEN 'TRUNCATE' THEN format('TRUNCATE public.%I', t) END;
      BEGIN EXECUTE v_sql;
      EXCEPTION WHEN insufficient_privilege THEN blocked := blocked + 1;
      END;
    END LOOP;
  END LOOP;
  RESET ROLE;
  IF blocked <> total THEN RAISE EXCEPTION 'PO-SEC-1: anon bloqueado em %/% operações', blocked, total; END IF;

  -- authenticated: TRUNCATE em cada regulada + SELECT nas 2 views DEFINER → 42501
  blocked := 0; total := 0;
  SET LOCAL ROLE authenticated;
  FOREACH t IN ARRAY regulated LOOP
    total := total + 1;
    BEGIN EXECUTE format('TRUNCATE public.%I', t);
    EXCEPTION WHEN insufficient_privilege THEN blocked := blocked + 1;
    END;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['user_emails','feedback_stats'] LOOP
    total := total + 1;
    BEGIN EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', t);
    EXCEPTION WHEN insufficient_privilege THEN blocked := blocked + 1;
    END;
  END LOOP;
  RESET ROLE;
  IF blocked <> total THEN RAISE EXCEPTION 'PO-SEC-1: authenticated bloqueado em %/%', blocked, total; END IF;

  -- anon e user_emails/feedback_stats
  SET LOCAL ROLE anon;
  FOREACH t IN ARRAY ARRAY['user_emails','feedback_stats'] LOOP
    BEGIN EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', t);
      RAISE EXCEPTION 'PO-SEC-1: anon leu %', t;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  RESET ROLE;
END $$;

-- ─── 5. PO-2 (SQL): allowlist do anon funciona; authenticated lê o que a matriz manda ───────
DO $$
DECLARE n int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM (SELECT platform, min_supported_version, is_active, message, store_url FROM public.app_version_gate) x;
  SELECT count(*) INTO n FROM public.consent_policy;
  RESET ROLE;

  PERFORM set_config('request.jwt.claims', '{"sub":"10800000-0000-4000-8000-000000000108","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.medicines;           IF n <> 1 THEN RAISE EXCEPTION 'PO-2: medicines %', n; END IF;
  SELECT count(*) INTO n FROM public.protocols;           IF n <> 1 THEN RAISE EXCEPTION 'PO-2: protocols %', n; END IF;
  SELECT count(*) INTO n FROM public.dose_instances;      IF n <> 1 THEN RAISE EXCEPTION 'PO-2: dose_instances %', n; END IF;
  SELECT count(*) INTO n FROM public.medicine_stock_summary;
  SELECT count(*) INTO n FROM public.v_daily_adherence;
  SELECT count(*) INTO n FROM public.v_adherence_heatmap;
  SELECT count(*) INTO n FROM (SELECT id, consent_type, action, policy_version, platform, created_at FROM public.consent_log) x;
  UPDATE public.medicines SET name = 'probe 108b' WHERE user_id = '10800000-0000-4000-8000-000000000108';
  UPDATE public.dose_instances SET status = 'taken' WHERE user_id = '10800000-0000-4000-8000-000000000108';  -- INV-6: segue permitido
  RESET ROLE;
END $$;

-- ─── 6. PO-5: exclusão de conta apaga tudo do usuário nas tabelas restantes ─────────────────
SELECT public._delete_user_account_core('10800000-0000-4000-8000-000000000108');
DO $$
DECLARE t text; n bigint; leftovers text := '';
BEGIN
  -- toda tabela do public com user_id. Exceções declaradas: prune_queue/prune_queue_audit (registro do
  -- job de exclusão, 107 — fora deste teste; nada inserido). consent_log: FK SET NULL (prova LGPD
  -- pseudonimizada por subject_hash) ⇒ 0 linhas com o user_id.
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'user_id'
            WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
              AND c.relname NOT IN ('prune_queue','prune_queue_audit') LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = %L', t, '10800000-0000-4000-8000-000000000108') INTO n;
    IF n <> 0 THEN leftovers := leftovers || t || '=' || n || ' '; END IF;
  END LOOP;
  IF leftovers <> '' THEN RAISE EXCEPTION 'PO-5: sobrou dado do usuário: %', leftovers; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '10800000-0000-4000-8000-000000000108') THEN
    RAISE EXCEPTION 'PO-5: auth.users não apagado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.consent_log WHERE subject_hash IS NOT NULL AND action = 'account_deleted'
                  AND user_id IS NULL AND created_at >= now() - interval '1 minute') THEN
    RAISE EXCEPTION 'PO-5: consent_log account_deleted não registrado'; END IF;
END $$;

DO $$ BEGIN
  RAISE EXCEPTION 'RESULT 6/6 — FR-014, PO-SEC-3, PO-10, PO-SEC-1, PO-2(SQL), PO-5 verdes (tudo desfeito)';
END $$;
