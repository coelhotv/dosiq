-- Spec 115 — prova de 20261103_admin_growth_analytics.sql (PO-115-1, -2, -4, -6, -8, PO-SEC-1).
--
-- Execução (MCP execute_sql, QA `ikcvwxyohmntncanclze`): roda DEPOIS da migração aplicada e termina
-- com RAISE EXCEPTION 'RESULT …' — o erro final desfaz a fixture. Nada sobra no banco.
--
-- RESULTADO REGISTRADO — QA (ikcvwxyohmntncanclze), 2026-11-05: RESULT OK — PO-115-1/2/3/4/6/8 + PO-SEC-1/4/5
--   (fixture 5 usuários, 7 pré-existentes excluídos; desfeito). md5(prosrc) 9389389e… = arquivo.
-- RESULTADO REGISTRADO — PROD (kwqjtdsqkkbebfiaxubb), 2026-11-05, aprovação do PO no #931 (merge cfd5f09d):
--   Fixture NÃO roda em prod (insere em auth.users; manipulação de dados só no QA). Provas sem escrita:
--   md5(prosrc) 9389389e… (9795) = arquivo · prosecdef true · proconfig {search_path=""}                ✅
--   routine_privileges = postgres:EXECUTE, service_role:EXECUTE                                        ✅
--   POST /rest/v1/rpc/get_admin_growth_analytics com chave anon ⇒ HTTP 401 / 42501                     ✅
--   EXPLAIN ANALYZE (limit 500): Execution Time 36.783 ms · 82 usuários · payload sem user-agent bruto ✅

-- Isolamento: o QA já tem usuários. Toda chamada passa os usuários pré-existentes em
-- p_excluded_user_ids, então os números abaixo são só da fixture (A, B, C, D, X).
--   A — criado hoje · 2 tratamentos A10S (um com titulação + peso + alarme + estoque + data fim)
--       + 1 tratamento ARQUIVADO C7A com todas as features (não pode contar)
--   B — criado há 60 dias · 1 tratamento A10C9 (insulina), sem features
--   C — criado hoje · 1 tratamento C7A0 PAUSADO (active=false) com alarme crítico (conta)
--   D — criado hoje · 1 tratamento de medicamento sem therapeutic_class_code
--   X — criado hoje · 1 tratamento A8A (alvo da exclusão do PO-115-8)
-- Plataformas (D-AN-2 / PO-115-3 / PO-SEC-5):
--   A — aparelho Android de 2 dias atrás + sessão do app iOS agora ⇒ [android, ios], principal ios
--   B — deslogou do app (sem aparelho) · sessões okhttp (antiga) e navegador (recente) ⇒ [android, web], principal web
--   C — só sessão curl ⇒ [] (UA fora dos prefixos é ignorado)

DO $$
DECLARE
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  d uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  m_a1 uuid; m_a2 uuid; m_b uuid; m_c uuid; m_d uuid; m_x uuid; m_arch uuid;
  p_a1 uuid; p_arch uuid; t_a uuid;
  others uuid[];
  r jsonb; r_all jsonb; r_def jsonb; r_empty jsonb;
  feat jsonb; cls jsonb; ua jsonb; ub jsonb; uc jsonb;
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO others FROM auth.users;

  INSERT INTO auth.users (id, email, created_at, last_sign_in_at) VALUES
    (a, 'growth-a@fixture.test', now(), now()),
    (b, 'growth-b@fixture.test', now() - interval '60 days', now() - interval '59 days'),
    (c, 'growth-c@fixture.test', now(), NULL),
    (d, 'growth-d@fixture.test', now(), NULL),
    (x, 'growth-x@fixture.test', now(), NULL);

  INSERT INTO public.medicines (user_id, name, therapeutic_class, therapeutic_class_code)
    VALUES (a, 'SECRET_MED_NAME_A1', 'Antidiabeticos', 'A10S') RETURNING id INTO m_a1;
  INSERT INTO public.medicines (user_id, name, therapeutic_class, therapeutic_class_code)
    VALUES (a, 'SECRET_MED_NAME_A2', 'Antidiabeticos', 'A10S') RETURNING id INTO m_a2;
  INSERT INTO public.medicines (user_id, name, therapeutic_class, therapeutic_class_code)
    VALUES (a, 'SECRET_MED_NAME_ARCH', 'Anti-hipertensivos', 'C7A') RETURNING id INTO m_arch;
  INSERT INTO public.medicines (user_id, name, therapeutic_class, therapeutic_class_code)
    VALUES (b, 'SECRET_MED_NAME_B', 'Antidiabeticos', 'A10C9') RETURNING id INTO m_b;
  INSERT INTO public.medicines (user_id, name, therapeutic_class, therapeutic_class_code)
    VALUES (c, 'SECRET_MED_NAME_C', 'Betabloqueadores', 'C7A0') RETURNING id INTO m_c;
  INSERT INTO public.medicines (user_id, name, therapeutic_class, therapeutic_class_code)
    VALUES (d, 'SECRET_MED_NAME_D', NULL, NULL) RETURNING id INTO m_d;
  INSERT INTO public.medicines (user_id, name, therapeutic_class, therapeutic_class_code)
    VALUES (x, 'SECRET_MED_NAME_X', 'Antiobesidade', 'A8A') RETURNING id INTO m_x;

  INSERT INTO public.protocols (user_id, medicine_id, name, frequency, start_date, tracked_measure, critical_alarm, end_date)
    VALUES (a, m_a1, 'Tratamento A1', 'semanal', current_date, 'peso', true, current_date + 90) RETURNING id INTO p_a1;
  INSERT INTO public.protocols (user_id, medicine_id, name, frequency, start_date)
    VALUES (a, m_a2, 'Tratamento A2', 'diário', current_date);
  INSERT INTO public.protocols (user_id, medicine_id, name, frequency, start_date, tracked_measure, critical_alarm, end_date, archived_at, active)
    VALUES (a, m_arch, 'Tratamento Arquivado', 'diário', current_date, 'pressao_arterial', true, current_date + 10, now(), false) RETURNING id INTO p_arch;
  INSERT INTO public.protocols (user_id, medicine_id, name, frequency, start_date)
    VALUES (b, m_b, 'Tratamento B', 'diário', current_date);
  INSERT INTO public.protocols (user_id, medicine_id, name, frequency, start_date, critical_alarm, active)
    VALUES (c, m_c, 'Tratamento C', 'diário', current_date, true, false);
  INSERT INTO public.protocols (user_id, medicine_id, name, frequency, start_date)
    VALUES (d, m_d, 'Tratamento D', 'dias_alternados', current_date);
  INSERT INTO public.protocols (user_id, medicine_id, name, frequency, start_date)
    VALUES (x, m_x, 'Tratamento X', 'semanal', current_date);

  INSERT INTO public.titrations (user_id) VALUES (a) RETURNING id INTO t_a;
  INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit, status, protocol_id)
    VALUES (t_a, a, 0, m_a1, 0.25, 'mg', 'upcoming', p_a1);
  -- arquivado também tem escada e estoque: se o predicado vazar, os números abaixo mudam
  INSERT INTO public.titration_steps (titration_id, user_id, position, medicine_id, dose, intake_unit, status, protocol_id)
    VALUES (t_a, a, 1, m_arch, 1, 'mg', 'upcoming', p_arch);
  INSERT INTO public.stock (user_id, medicine_id, quantity, purchase_date) VALUES (a, m_a1, 4, current_date);
  INSERT INTO public.stock (user_id, medicine_id, quantity, purchase_date) VALUES (a, m_arch, 4, current_date);

  INSERT INTO public.device_activity (user_id, device_fingerprint, platform, app_version, last_seen_at)
    VALUES (a, 'fixture-115-a', 'android', '0.34.0', now() - interval '2 days');
  INSERT INTO auth.sessions (id, user_id, created_at, updated_at, user_agent) VALUES
    (gen_random_uuid(), a, now() - interval '1 hour', now(), 'Dosiq/45 CFNetwork/1.0 Darwin/24.0'),
    (gen_random_uuid(), b, now() - interval '50 days', now() - interval '40 days', 'okhttp/4.12.0'),
    (gen_random_uuid(), b, now() - interval '5 days', now() - interval '1 day', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'),
    (gen_random_uuid(), c, now() - interval '1 day', now(), 'curl/8.7.1');

  -- ===== Cenário principal: X excluído junto com o resto do QA =====
  r := public.get_admin_growth_analytics(100, 0, others || x);

  -- PO-115-8: excluded_count conta os pré-existentes + X; X fora da lista de usuários
  IF (r->>'excluded_count')::int <> coalesce(array_length(others, 1), 0) + 1 THEN
    RAISE EXCEPTION 'PO-115-8: excluded_count=% (esperado %)', r->>'excluded_count', coalesce(array_length(others, 1), 0) + 1;
  END IF;
  IF (r->>'total_users')::int <> 4 THEN RAISE EXCEPTION 'PO-115-8: total_users=% (esperado 4)', r->>'total_users'; END IF;
  IF r::text LIKE '%' || x::text || '%' OR r::text LIKE '%A8A%' THEN RAISE EXCEPTION 'PO-115-8: X vazou no payload'; END IF;

  -- PO-115-1: A10S = 1 usuário / 2 tratamentos; sem código aparece e entra no denominador
  SELECT e INTO cls FROM jsonb_array_elements(r->'class_distribution') e WHERE e->>'class_code' = 'A10S';
  IF (cls->>'users')::int <> 1 OR (cls->>'protocols')::int <> 2 OR cls->>'wedge' <> 'glp1_antiobesidade' THEN
    RAISE EXCEPTION 'PO-115-1: A10S=%', cls;
  END IF;
  SELECT e INTO cls FROM jsonb_array_elements(r->'class_distribution') e WHERE e->>'class_code' = 'sem_codigo';
  IF (cls->>'users')::int <> 1 OR (cls->>'users_pct')::numeric <> 25.0 THEN RAISE EXCEPTION 'PO-115-1: sem_codigo=%', cls; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'class_distribution') e WHERE e->>'class_code' = 'C7A') THEN
    RAISE EXCEPTION 'PO-115-2: tratamento arquivado entrou na distribuição';
  END IF;
  IF (r#>>'{wedge,glp1_antiobesidade,users}')::int <> 1 OR (r#>>'{wedge,glp1_antiobesidade,users_pct}')::numeric <> 25.0
     OR (r#>>'{wedge,antidiabeticos_outros,users}')::int <> 1 OR (r#>>'{wedge,outras,users}')::int <> 1
     OR (r#>>'{wedge,sem_codigo,users}')::int <> 1 THEN
    RAISE EXCEPTION 'PO-115-1: wedge=%', r->'wedge';
  END IF;

  -- PO-115-2: 4 usuários com protocolo vivo, 5 protocolos vivos; coorte 30d = A, C, D (4 protocolos)
  IF (r#>>'{denominators,users_all}')::int <> 4 OR (r#>>'{denominators,protocols_all}')::int <> 5
     OR (r#>>'{denominators,users_c30}')::int <> 3 OR (r#>>'{denominators,protocols_c30}')::int <> 4 THEN
    RAISE EXCEPTION 'PO-115-2: denominators=%', r->'denominators';
  END IF;
  SELECT e INTO feat FROM jsonb_array_elements(r->'feature_rates') e WHERE e->>'feature' = 'titration';
  IF (feat->>'users')::int <> 1 OR (feat->>'users_pct')::numeric <> 25.0 OR (feat->>'protocols_pct')::numeric <> 20.0
     OR (feat#>>'{cohort30,users_pct}')::numeric <> 33.3 THEN
    RAISE EXCEPTION 'PO-115-2: titration=%', feat;
  END IF;
  SELECT e INTO feat FROM jsonb_array_elements(r->'feature_rates') e WHERE e->>'feature' = 'critical_alarm';
  IF (feat->>'users')::int <> 2 OR (feat->>'users_pct')::numeric <> 50.0 OR (feat->>'protocols')::int <> 2 THEN
    RAISE EXCEPTION 'PO-115-2: critical_alarm (pausado conta, arquivado não)=%', feat;
  END IF;
  SELECT e INTO feat FROM jsonb_array_elements(r->'feature_rates') e WHERE e->>'feature' = 'stock';
  IF (feat->>'users')::int <> 1 OR (feat->>'protocols')::int <> 1 THEN RAISE EXCEPTION 'PO-115-2: stock=%', feat; END IF;
  SELECT e INTO feat FROM jsonb_array_elements(r->'feature_rates') e WHERE e->>'feature' = 'biomarker';
  IF (feat->>'users')::int <> 1 OR (feat->>'protocols')::int <> 1 THEN RAISE EXCEPTION 'PO-115-2: biomarker=%', feat; END IF;
  SELECT e INTO feat FROM jsonb_array_elements(r->'feature_rates') e WHERE e->>'feature' = 'end_date';
  IF (feat->>'users')::int <> 1 OR (feat#>>'{cohort30,users}')::int <> 1 THEN RAISE EXCEPTION 'PO-115-2: end_date=%', feat; END IF;
  IF jsonb_array_length(r->'feature_rates') <> 5 THEN RAISE EXCEPTION 'PO-115-2: features=%', jsonb_array_length(r->'feature_rates'); END IF;

  -- PO-115-4 / SC-004: nenhum nome comercial no payload; drill-down de A com 2 tratamentos e badges
  IF r::text LIKE '%SECRET_MED_NAME%' OR r::text LIKE '%"name"%' THEN RAISE EXCEPTION 'PO-115-4: medicines.name vazou'; END IF;
  SELECT e INTO ua FROM jsonb_array_elements(r->'users') e WHERE e->>'user_id' = a::text;
  IF (ua->>'protocols_count')::int <> 2 OR jsonb_array_length(ua->'treatments') <> 2
     OR ua->>'email' <> 'growth-a@fixture.test' THEN
    RAISE EXCEPTION 'PO-115-4: usuário A=%', ua;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ua->'treatments') t
                 WHERE t->>'protocol_name' = 'Tratamento A1' AND (t#>>'{features,titration}')::boolean
                   AND t#>>'{features,tracked_measure}' = 'peso' AND (t#>>'{features,stock}')::boolean
                   AND t->>'therapeutic_class' = 'Antidiabeticos' AND t->>'frequency' = 'semanal') THEN
    RAISE EXCEPTION 'PO-115-4: badges de A1=%', ua->'treatments';
  END IF;

  -- PO-115-3 / D-AN-2: plataformas = canais já usados; principal = atividade mais recente
  SELECT e INTO ub FROM jsonb_array_elements(r->'users') e WHERE e->>'user_id' = b::text;
  SELECT e INTO uc FROM jsonb_array_elements(r->'users') e WHERE e->>'user_id' = c::text;
  IF ua->'platforms' <> '["android", "ios"]'::jsonb OR ua->>'platform' <> 'ios' OR ua->>'app_version' <> '0.34.0' THEN
    RAISE EXCEPTION 'PO-115-3: plataformas de A=% / % / %', ua->'platforms', ua->>'platform', ua->>'app_version';
  END IF;
  IF ub->'platforms' <> '["android", "web"]'::jsonb OR ub->>'platform' <> 'web' OR ub->>'app_version' IS NOT NULL THEN
    RAISE EXCEPTION 'PO-115-3: deslogado B=% / % / %', ub->'platforms', ub->>'platform', ub->>'app_version';
  END IF;
  -- PO-SEC-5: UA fora dos prefixos não vira plataforma; nenhum UA bruto no payload
  IF uc->'platforms' <> '[]'::jsonb OR uc->>'platform' IS NOT NULL THEN
    RAISE EXCEPTION 'PO-SEC-5: curl virou plataforma=%', uc->'platforms';
  END IF;
  IF r::text ~* '(okhttp|mozilla|cfnetwork|curl/|darwin)' THEN RAISE EXCEPTION 'PO-SEC-5: user-agent bruto no payload'; END IF;

  -- paginação: limit 1 devolve 1 linha, total_users segue 4
  r_all := public.get_admin_growth_analytics(1, 0, others || x);
  IF jsonb_array_length(r_all->'users') <> 1 OR (r_all->>'total_users')::int <> 4 THEN RAISE EXCEPTION 'paginação: %', r_all->'total_users'; END IF;
  -- clamp: limit 0/negativo não quebra
  r_all := public.get_admin_growth_analytics(-5, -5, NULL);
  IF jsonb_array_length(r_all->'users') < 1 THEN RAISE EXCEPTION 'clamp: limit negativo zerou a lista'; END IF;

  -- ===== PO-115-8 parte 2: sem X na lista, X volta =====
  r := public.get_admin_growth_analytics(100, 0, others);
  IF (r->>'total_users')::int <> 5 OR (r#>>'{wedge,glp1_antiobesidade,users}')::int <> 2 THEN
    RAISE EXCEPTION 'PO-115-8: sem exclusão de X total=% glp1=%', r->>'total_users', r#>>'{wedge,glp1_antiobesidade,users}';
  END IF;
  -- {} explícito == chamada sem o parâmetro
  r_def := public.get_admin_growth_analytics();
  r_empty := public.get_admin_growth_analytics(100, 0, '{}');
  IF (r_def - 'generated_at') <> (r_empty - 'generated_at') OR (r_empty->>'excluded_count')::int <> 0 THEN
    RAISE EXCEPTION 'PO-115-8: {} difere do default';
  END IF;

  -- ===== PO-115-6 / PO-SEC-1: grants e definer endurecida =====
  IF has_function_privilege('anon', 'public.get_admin_growth_analytics(integer, integer, uuid[])', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_admin_growth_analytics(integer, integer, uuid[])', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_admin_growth_analytics(integer, integer, uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'PO-115-6: grants errados';
  END IF;
  -- PO-SEC-4 / S-11: o dono da função ainda lê auth.sessions (upgrade do Supabase acusa aqui)
  IF NOT has_table_privilege('postgres', 'auth.sessions', 'SELECT') THEN
    RAISE EXCEPTION 'PO-SEC-4: postgres perdeu SELECT em auth.sessions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_growth_analytics' AND prosecdef
                 AND proconfig = ARRAY['search_path=""']) THEN
    RAISE EXCEPTION 'PO-SEC-1: definer/search_path=%', (SELECT proconfig FROM pg_proc WHERE proname = 'get_admin_growth_analytics');
  END IF;

  RAISE EXCEPTION 'RESULT OK — PO-115-1/2/3/4/6/8 + PO-SEC-1/4/5 (fixture 5 usuários, % pré-existentes excluídos; desfeito)', coalesce(array_length(others, 1), 0);
END $$;
