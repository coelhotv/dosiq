-- Spec 106 — Guarda dos registros de acesso por 6 meses (Marco Civil, art. 15). ADR-113.
-- Uma função de pré-request da Data API (pgrst.db_pre_request) lê o `sub` do JWT e o
-- `cf-connecting-ip` de toda requisição de usuário autenticado. Na 1ª ocorrência de
-- (conta, IP, hora UTC) grava em private.access_log por dblink, como o papel access_log_writer
-- (o GET roda em transação somente-leitura: INSERT direto falha com 25006). pg_cron apaga o que
-- passa de 6 meses. public.access_log_health() alimenta o audit diário (api/notify.ts 05:00).
--
-- Aplicado via Supabase MCP (apply_migration) após dry-run BEGIN..ROLLBACK.
-- A senha do access_log_writer e o segredo ACCESS_LOG_WRITER_DSN_PASSWORD NÃO estão aqui:
-- provisionamento em docs/operations/RUNBOOK_ACCESS_LOG.md.
--
-- R-270 — Failure Modes (spec 106 F-1…F-10, plan "Comportamento de capture_access"):
--   claims ausentes / role ≠ authenticated → RETURN sem gravar (anon e service_role passam reto).
--   sub não-uuid / cf-connecting-ip ausente ou não-inet → cast dentro do EXCEPTION → RETURN.
--   INV-8   o IP vem só de cf-connecting-ip (a borda o controla; forjado ⇒ 403 na Cloudflare).
--           Nunca x-forwarded-for, x-real-ip ou auth.sessions.ip (forjáveis — PO-SEC-1).
--   segredo ausente → RETURN sem lançar; access_log_health (e).
--   dblink recusado / timeout / slots esgotados → connect_timeout=2 → EXCEPTION → RETURN.
--   tabela ausente/renomeada → EXCEPTION → RETURN: a requisição do app NUNCA falha (INV-4).
--   corrida na 1ª ocorrência → unique + ON CONFLICT DO NOTHING SEM alvo: com alvo
--           (ON CONSTRAINT) o Postgres exige SELECT, que o papel não tem (42501, T001).
--   authenticator tem statement_timeout=8s e safeupdate: o pior caso (2 s) cabe; INSERT e o
--           DELETE do purge (com WHERE) não são barrados pelo safeupdate.
--   S-2     nenhum RAISE: IP/user_id nunca vão para log do Postgres nem para o Sentry
--           (health devolve só contagem e horário). A falha é vista pelo health (a).
--   S-3/AP-275 schemas novos nascem sem grant; toda função revoga EXECUTE nomeado. A ÚNICA
--           função executável por anon/authenticated/service_role é access_hook.capture_access
--           (o pré-request roda com o papel da requisição — sem EXECUTE, a API inteira cai).
--   S-4     access_log_disclosures registra toda extração sob ordem judicial (sem IP).
--   INV-5   sem FK para auth.users: exclusão de conta não apaga nem altera o registro.

-- 1. Extensão.
CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

-- 2. Schema fora do PostgREST (só `public` é exposto) — INV-1.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
REVOKE ALL ON SCHEMA private FROM service_role;

CREATE TABLE IF NOT EXISTS private.access_log (
  user_id     uuid        NOT NULL,
  ip          inet        NOT NULL,
  hour_bucket timestamptz NOT NULL,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  source      text        NOT NULL DEFAULT 'data_api' CHECK (source IN ('data_api')),
  CONSTRAINT access_log_uniq UNIQUE (user_id, ip, hour_bucket, source)
);

CREATE TABLE IF NOT EXISTS private.access_log_runs (
  id     bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  job    text        NOT NULL CHECK (job IN ('purge')),
  rows   integer
);

-- Registro de cada entrega a terceiros sob ordem judicial (Marco Civil art. 10 §1º, art. 15 §3º).
-- Sem IP: só quem pediu, o quê, quando e quem executou. Não é apagado pelo purge.
CREATE TABLE IF NOT EXISTS private.access_log_disclosures (
  id           bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requested_at timestamptz NOT NULL,
  case_ref     text        NOT NULL CHECK (length(btrim(case_ref)) > 0),
  user_id      uuid        NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  executed_by  text        NOT NULL CHECK (length(btrim(executed_by)) > 0),
  delivered_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start)
);

ALTER TABLE private.access_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.access_log_runs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.access_log_disclosures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.access_log, private.access_log_runs, private.access_log_disclosures FROM PUBLIC;
REVOKE ALL ON private.access_log, private.access_log_runs, private.access_log_disclosures FROM anon;
REVOKE ALL ON private.access_log, private.access_log_runs, private.access_log_disclosures FROM authenticated;
REVOKE ALL ON private.access_log, private.access_log_runs, private.access_log_disclosures FROM service_role;

-- 3. Papel que grava. Só INSERT em access_log, nada mais (nem SELECT). Senha fora da migração.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'access_log_writer') THEN
    CREATE ROLE access_log_writer LOGIN NOINHERIT;
  END IF;
END
$$;

-- O INSERT deste papel leva IP e user_id no texto: nunca pode ir para o log do Postgres, mesmo que
-- alguém suba o log_statement global (hoje 'ddl') — S-2, RC5 2026-10-20.
ALTER ROLE access_log_writer SET log_statement = 'none';
ALTER ROLE access_log_writer SET log_min_duration_statement = -1;

GRANT USAGE  ON SCHEMA private     TO access_log_writer;
GRANT INSERT ON private.access_log TO access_log_writer;

DROP POLICY IF EXISTS access_log_writer_insert ON private.access_log;
CREATE POLICY access_log_writer_insert ON private.access_log
  FOR INSERT TO access_log_writer WITH CHECK (true);

-- 4. Captura (pré-request). Roda em TODA requisição da Data API: caminho rápido = 1 SELECT por
--    índice; nada aqui pode falhar para fora (INV-4).
CREATE SCHEMA IF NOT EXISTS access_hook;
REVOKE ALL ON SCHEMA access_hook FROM PUBLIC;
GRANT USAGE ON SCHEMA access_hook TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION access_hook.capture_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims jsonb;
  v_sub    uuid;
  v_ip     inet;
  v_hour   timestamptz;
  v_pwd    text;
BEGIN
  v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF v_claims IS NULL OR v_claims ->> 'role' IS DISTINCT FROM 'authenticated' THEN
    RETURN;
  END IF;

  v_sub := (v_claims ->> 'sub')::uuid;
  v_ip  := (nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip')::inet;
  IF v_sub IS NULL OR v_ip IS NULL THEN
    RETURN;
  END IF;

  v_hour := date_trunc('hour', now(), 'UTC');

  PERFORM 1 FROM private.access_log
   WHERE user_id = v_sub AND ip = v_ip AND hour_bucket = v_hour AND source = 'data_api';
  IF FOUND THEN
    RETURN;
  END IF;

  SELECT s.decrypted_secret INTO v_pwd
    FROM vault.decrypted_secrets s
   WHERE s.name = 'ACCESS_LOG_WRITER_DSN_PASSWORD';
  IF coalesce(v_pwd, '') = '' THEN
    RETURN;
  END IF;

  -- Conexão nova, fechada na mesma chamada: grava mesmo se a transação da requisição for
  -- somente-leitura (GET) ou fizer rollback (POST com erro).
  -- Host = nome público do banco, não 127.0.0.1: na rede local o pg_hba dispensa senha, e o dblink
  -- recusa conexão de não-superusuário que não usou a senha (2F003) — medido no T001, 2026-10-20.
  PERFORM extensions.dblink_exec(
    format('host=db.kwqjtdsqkkbebfiaxubb.supabase.co port=5432 dbname=%s user=access_log_writer password=%s connect_timeout=2',
           current_database(), v_pwd),
    format('INSERT INTO private.access_log (user_id, ip, hour_bucket) VALUES (%L, %L, %L) '
           'ON CONFLICT DO NOTHING',
           v_sub, v_ip, v_hour));
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION access_hook.capture_access() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION access_hook.capture_access() TO anon, authenticated, service_role;

-- 5. Saúde da coleta (FR-004). Em `public` porque o servidor só alcança RPC exposta; lê `private`
--    por SECURITY DEFINER. Uma linha por problema; lista vazia = saudável. `detail` traz só
--    contagem e horário — nunca ip ou user_id (S-2).
CREATE OR REPLACE FUNCTION public.access_log_health()
RETURNS TABLE (check_name text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sessions bigint;
  v_rows     bigint;
  v_last     timestamptz;
  v_oldest   timestamptz;
  v_failed   bigint;
BEGIN
  -- (b) pré-request ligado no authenticator.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_db_role_setting s
      JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
     CROSS JOIN LATERAL unnest(s.setconfig) AS cfg
     WHERE r.rolname = 'authenticator'
       AND cfg = 'pgrst.db_pre_request=access_hook.capture_access') THEN
    check_name := 'pre_request_missing';
    detail := 'pgrst.db_pre_request do authenticator não aponta para access_hook.capture_access';
    RETURN NEXT;
  END IF;

  -- (e) segredo do papel que grava.
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
     WHERE name = 'ACCESS_LOG_WRITER_DSN_PASSWORD' AND coalesce(decrypted_secret, '') <> '') THEN
    check_name := 'writer_secret_missing';
    detail := 'segredo ACCESS_LOG_WRITER_DSN_PASSWORD ausente ou vazio no Vault';
    RETURN NEXT;
  END IF;

  -- (a) uso nas últimas 24 h sem linha nova (sessões renovadas como sinal de uso).
  SELECT count(*) INTO v_sessions FROM auth.sessions WHERE updated_at > now() - interval '24 hours';
  SELECT count(*) INTO v_rows FROM private.access_log WHERE first_seen > now() - interval '24 hours';
  IF v_sessions > 0 AND v_rows = 0 THEN
    SELECT max(first_seen) INTO v_last FROM private.access_log;
    check_name := 'capture_stalled';
    detail := 'sessoes_renovadas_24h=' || v_sessions || '; ultima_linha=' || coalesce(v_last::text, 'nenhuma');
    RETURN NEXT;
  END IF;

  -- (c) purge falhou nas últimas 48 h.
  SELECT count(*) INTO v_failed
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
   WHERE j.jobname = 'prune-access-log' AND d.status = 'failed'
     AND d.start_time > now() - interval '48 hours';
  IF v_failed > 0 THEN
    check_name := 'purge_failed';
    detail := 'falhas_48h=' || v_failed;
    RETURN NEXT;
  END IF;

  -- (d) purge parado: nada pode passar de 6 meses + 2 dias (INV-2).
  SELECT min(hour_bucket) INTO v_oldest FROM private.access_log;
  IF v_oldest < now() - interval '6 months 2 days' THEN
    check_name := 'purge_stalled';
    detail := 'linha_mais_antiga=' || v_oldest::text;
    RETURN NEXT;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.access_log_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.access_log_health() FROM anon;
REVOKE EXECUTE ON FUNCTION public.access_log_health() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.access_log_health() TO service_role;

-- 6. Purge diário (FR-003). Intervalo fixo no corpo: nenhum parâmetro vem de fora.
CREATE OR REPLACE FUNCTION private.purge_access_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM private.access_log WHERE hour_bucket < now() - interval '6 months';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM private.access_log_runs WHERE ran_at < now() - interval '6 months';
  INSERT INTO private.access_log_runs (job, rows) VALUES ('purge', v_count);

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.purge_access_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.purge_access_log() FROM anon;
REVOKE EXECUTE ON FUNCTION private.purge_access_log() FROM authenticated;
REVOKE EXECUTE ON FUNCTION private.purge_access_log() FROM service_role;

SELECT cron.schedule(
  'prune-access-log',
  '45 3 * * *',
  $$ SELECT private.purge_access_log() $$
);

-- 7. Liga a coleta POR ÚLTIMO, depois do segredo provisionado (runbook) e da prova T001.
ALTER ROLE authenticator SET pgrst.db_pre_request = 'access_hook.capture_access';
NOTIFY pgrst, 'reload config';

-- Reversão — desligar a coleta em 1 comando (as duas primeiras linhas bastam):
--   ALTER ROLE authenticator RESET pgrst.db_pre_request;
--   NOTIFY pgrst, 'reload config';
--   SELECT cron.unschedule('prune-access-log');
--   DROP FUNCTION IF EXISTS public.access_log_health();
--   DROP FUNCTION IF EXISTS private.purge_access_log();
--   DROP FUNCTION IF EXISTS access_hook.capture_access();
--   As tabelas FICAM: o conteúdo está sob obrigação legal de guarda (Marco Civil art. 15).
