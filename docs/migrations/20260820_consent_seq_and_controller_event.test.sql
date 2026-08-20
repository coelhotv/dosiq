-- 20260820_consent_seq_and_controller_event.test.sql — 046 Slice C / T013e + T013a
--
-- Validação por FAILURE MODE em BEGIN..ROLLBACK (R-270). Cada bloco roda ISOLADO (o RAISE aborta
-- a transação): rodar bloco a bloco e colar o output no C4.
--
-- Blocos:
--   1. T013e — empate de `created_at` na MESMA txn: ordenação por `seq` é estável
--   2. T013a — guarda de chamador (PO-SEC): anon/authenticated não executam a RPC
--   3. T013a — caminho feliz: hash bate com `consent_subject_hash`, platform='server'
--   4. T013a — degenerados: user_id NULL, ação de titular, conta inexistente
--   5. perfil das funções + grants de coluna (`seq` invisível para `authenticated`)

-- ═══ Bloco 1 — empate de created_at, ordenação estável por seq ════════════════
-- Os dois INSERTs ocorrem na MESMA transação ⇒ `now()` idêntico ⇒ `created_at` empatado.
-- Antes do T013e, `ORDER BY created_at DESC LIMIT 1` podia eleger qualquer um dos dois.
BEGIN;
  CREATE TEMP TABLE t1 ON COMMIT DROP AS SELECT id AS uid FROM auth.users LIMIT 1;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  SELECT uid, repeat('a', 64), 'health_data', 'revoked', '0.3', 'server' FROM t1;
  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  SELECT uid, repeat('a', 64), 'health_data', 'granted', '0.3', 'server' FROM t1;

  -- esperado: os dois eventos com created_at IDÊNTICO (prova que o empate é real, não hipótese)
  SELECT count(DISTINCT created_at) AS esperado_1_timestamp_unico
    FROM public.consent_log
   WHERE user_id = (SELECT uid FROM t1) AND subject_hash = repeat('a', 64);

  -- esperado: 'granted' — o último inserido, sempre, em qualquer execução
  SELECT action AS esperado_granted
    FROM public.consent_log
   WHERE user_id = (SELECT uid FROM t1) AND subject_hash = repeat('a', 64)
   ORDER BY seq DESC LIMIT 1;
ROLLBACK;

-- ═══ Bloco 2 — guarda de chamador (AP-292) ════════════════════════════════════
-- 2a. authenticated ⇒ permission denied no EXECUTE (o GRANT nunca foi dado)
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT public.consent_controller_event(
    (SELECT id FROM auth.users LIMIT 1), 'notice_sent', 'health_data');  -- esperado: 42501
ROLLBACK;

-- 2b. anon ⇒ permission denied
BEGIN;
  SET LOCAL ROLE anon;
  SELECT public.consent_controller_event(
    (SELECT id FROM auth.users LIMIT 1), 'notice_sent', 'health_data');  -- esperado: 42501
ROLLBACK;

-- 2c. postgres (owner, sem auth.role() = service_role) ⇒ a guarda INTERNA barra.
--     Este é o bloco que prova que a guarda não é inerte: se estivesse escrita com
--     `current_user`, aqui ela deixaria passar (dentro de DEFINER current_user é o OWNER).
BEGIN;
  SELECT public.consent_controller_event(
    (SELECT id FROM auth.users LIMIT 1), 'notice_sent', 'health_data');  -- esperado: 'forbidden'
ROLLBACK;

-- ═══ Bloco 3 — caminho feliz (service_role) ═══════════════════════════════════
BEGIN;
  SET LOCAL ROLE service_role;
  CREATE TEMP TABLE t3 ON COMMIT DROP AS SELECT id AS uid, email FROM auth.users LIMIT 1;

  SELECT public.consent_controller_event((SELECT uid FROM t3), 'notice_sent', 'health_data') AS id_novo;

  RESET ROLE;
  -- esperado: hash IDÊNTICO ao derivado do e-mail (o pepper nunca saiu do banco), platform 'server'
  SELECT c.action, c.platform,
         (c.subject_hash = public.consent_subject_hash((SELECT email FROM t3))) AS esperado_true_hash_bate
    FROM public.consent_log c
   WHERE c.user_id = (SELECT uid FROM t3)
   ORDER BY c.seq DESC LIMIT 1;
ROLLBACK;

-- ═══ Bloco 4 — degenerados ════════════════════════════════════════════════════
-- 4a. user_id NULL ⇒ 'consent_subject_missing' (nunca uma linha órfã)
BEGIN;
  SET LOCAL ROLE service_role;
  SELECT public.consent_controller_event(NULL, 'notice_sent', 'health_data');
ROLLBACK;

-- 4b. ação do TITULAR pelo controlador ⇒ 'consent_action_not_allowed'
--     (o controlador não fabrica a vontade do titular — é o que torna a trilha prova)
BEGIN;
  SET LOCAL ROLE service_role;
  SELECT public.consent_controller_event(
    (SELECT id FROM auth.users LIMIT 1), 'granted', 'health_data');
ROLLBACK;

-- 4c. conta inexistente (já excluída) ⇒ 'consent_subject_email_missing'
BEGIN;
  SET LOCAL ROLE service_role;
  SELECT public.consent_controller_event(
    '00000000-0000-0000-0000-000000000000'::uuid, 'pruned', 'health_data');
ROLLBACK;

-- 4d. consent_type inválido ⇒ 'consent_type_invalid'
BEGIN;
  SET LOCAL ROLE service_role;
  SELECT public.consent_controller_event(
    (SELECT id FROM auth.users LIMIT 1), 'pruned', 'marketing');
ROLLBACK;

-- ═══ Bloco 5 — perfil e grants ════════════════════════════════════════════════
-- esperado: prosecdef=true e search_path='' nas duas funções
SELECT p.proname, p.prosecdef, p.proconfig
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname IN ('consent_controller_event','consent_write');

-- esperado: EXECUTE apenas para service_role (nada de PUBLIC/anon/authenticated)
SELECT grantee, privilege_type
  FROM information_schema.routine_privileges
 WHERE routine_schema = 'public' AND routine_name = 'consent_controller_event';

-- esperado: `seq` com SELECT para service_role e AUSENTE para authenticated (AP-275/S4)
SELECT grantee, privilege_type
  FROM information_schema.column_privileges
 WHERE table_name = 'consent_log' AND column_name = 'seq'
 ORDER BY grantee;

-- esperado: 0 — o `seq` só desempata daqui pra frente; nenhum empate histórico a reconstruir
SELECT count(*) AS esperado_0_empates_historicos
  FROM (SELECT user_id, consent_type, created_at
          FROM public.consent_log GROUP BY 1,2,3 HAVING count(*) > 1) x;
