-- Spec 106 — Guarda dos registros de acesso por 6 meses (Marco Civil, art. 15).
-- Um gatilho em auth.sessions copia (user_id, ip, hora UTC) a cada login/renovação de sessão para
-- private.access_log. pg_cron apaga o que passa de 6 meses. public.access_log_health() alimenta o
-- audit diário (api/notify.ts 05:00) e avisa no Sentry se a coleta parar.
--
-- Aplicado via Supabase MCP (apply_migration) após dry-run BEGIN..ROLLBACK.
--
-- R-270 — Failure Modes (spec 106 F-1…F-10, RC3 E-1…E-9, RC-SEC S-1…S-7):
--   F-1/F-10 auth.sessions muda ou o gatilho some → access_log_health (b)/(c).
--   F-3/E-5  erro no gatilho derrubaria login → EXCEPTION WHEN OTHERS → RETURN NEW, sempre.
--   E-6      insert do erro falha de novo → handler aninhado com EXCEPTION WHEN OTHERS THEN NULL.
--   F-6      refresh repetido na mesma hora → unique + upsert (last_seen = greatest).
--   F-7      purge parado → access_log_health (d).
--   E-2/INV-7 refreshed_at é timestamp SEM fuso → hora só de now(), truncada em 'UTC'.
--   NULL     sessão sem ip/user_id → RETURN NEW sem gravar.
--   S-2      nenhum RAISE e nenhum NEW.* no erro: IP/user_id nunca vão para log do Postgres
--            (log_min_messages = warning) nem para o Sentry (health devolve só contagem e horário).
--   S-3/AP-275 schema private nasce sem grant (sem default ACL global); funções revogam EXECUTE
--            nomeado de PUBLIC, anon e authenticated — public herda EXECUTE automático.
--   S-4      access_log_disclosures registra toda extração sob ordem judicial (sem IP).
--   INV-5    sem FK para auth.users: exclusão de conta não apaga nem altera o registro.

-- 1. Schema fora do PostgREST (só `public` é exposto) — INV-1.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
REVOKE ALL ON SCHEMA private FROM service_role;

-- 2. Tabelas.
CREATE TABLE IF NOT EXISTS private.access_log (
  user_id     uuid        NOT NULL,
  ip          inet        NOT NULL,
  hour_bucket timestamptz NOT NULL,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  source      text        NOT NULL DEFAULT 'auth_session' CHECK (source IN ('auth_session')),
  CONSTRAINT access_log_uniq UNIQUE (user_id, ip, hour_bucket, source)
);

CREATE TABLE IF NOT EXISTS private.access_log_runs (
  id     bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  job    text        NOT NULL CHECK (job IN ('capture_error', 'purge')),
  rows   integer,
  error  text
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

-- 3. Captura. Roda dentro da transação do GoTrue: nada aqui pode falhar para fora (INV-4).
CREATE OR REPLACE FUNCTION private.capture_access_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.ip IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO private.access_log (user_id, ip, hour_bucket, first_seen, last_seen, source)
  VALUES (NEW.user_id, NEW.ip, date_trunc('hour', now(), 'UTC'), now(), now(), 'auth_session')
  ON CONFLICT ON CONSTRAINT access_log_uniq
  DO UPDATE SET last_seen = greatest(private.access_log.last_seen, EXCLUDED.last_seen);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Só o código e a mensagem do erro, truncados; nunca NEW.* (S-2).
  BEGIN
    INSERT INTO private.access_log_runs (job, error)
    VALUES ('capture_error', left(SQLSTATE || ' ' || SQLERRM, 200));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.capture_access_log() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.capture_access_log() FROM anon;
REVOKE EXECUTE ON FUNCTION private.capture_access_log() FROM authenticated;
REVOKE EXECUTE ON FUNCTION private.capture_access_log() FROM service_role;

DROP TRIGGER IF EXISTS trg_access_log_capture ON auth.sessions;
CREATE TRIGGER trg_access_log_capture
  AFTER INSERT OR UPDATE OF ip, updated_at, refreshed_at ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION private.capture_access_log();

-- 4. Saúde da coleta (FR-004). Em `public` porque o servidor só alcança RPC exposta; lê `private`
--    por SECURITY DEFINER. Devolve uma linha por problema; lista vazia = saudável. `detail` traz só
--    contagem e horário — nunca ip ou user_id (S-2).
CREATE OR REPLACE FUNCTION public.access_log_health()
RETURNS TABLE (check_name text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sessions   bigint;
  v_rows       bigint;
  v_last       timestamptz;
  v_oldest     timestamptz;
  v_errors     bigint;
  v_last_error timestamptz;
  v_missing    text;
  v_enabled    "char";
BEGIN
  -- (b) colunas de auth.sessions que o gatilho usa.
  SELECT string_agg(e.col || ':' || e.typ, ', ')
    INTO v_missing
    FROM (VALUES ('user_id', 'uuid'),
                 ('ip', 'inet'),
                 ('updated_at', 'timestamp with time zone'),
                 ('refreshed_at', 'timestamp without time zone')) AS e(col, typ)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'auth' AND c.table_name = 'sessions'
        AND c.column_name = e.col AND c.data_type = e.typ);
  IF v_missing IS NOT NULL THEN
    check_name := 'sessions_schema_changed';
    detail := 'colunas ausentes ou com tipo novo: ' || v_missing;
    RETURN NEXT;
  END IF;

  -- (c) gatilho presente e habilitado.
  SELECT t.tgenabled INTO v_enabled
    FROM pg_catalog.pg_trigger t
   WHERE t.tgrelid = 'auth.sessions'::regclass AND t.tgname = 'trg_access_log_capture';
  IF v_enabled IS NULL THEN
    check_name := 'trigger_missing';
    detail := 'trg_access_log_capture não existe em auth.sessions';
    RETURN NEXT;
  ELSIF v_enabled = 'D' THEN
    check_name := 'trigger_disabled';
    detail := 'trg_access_log_capture está desabilitado';
    RETURN NEXT;
  END IF;

  -- (a) sessões renovadas nas últimas 24 h sem linha nova.
  SELECT count(*) INTO v_sessions FROM auth.sessions WHERE updated_at > now() - interval '24 hours';
  SELECT count(*), max(last_seen) INTO v_rows, v_last
    FROM private.access_log WHERE last_seen > now() - interval '24 hours';
  IF v_sessions > 0 AND v_rows = 0 THEN
    SELECT max(last_seen) INTO v_last FROM private.access_log;
    check_name := 'capture_stalled';
    detail := 'sessoes_renovadas_24h=' || v_sessions || '; ultima_linha=' || coalesce(v_last::text, 'nenhuma');
    RETURN NEXT;
  END IF;

  -- (d) purge parado: nada pode passar de 6 meses + 2 dias (INV-2).
  SELECT min(hour_bucket) INTO v_oldest FROM private.access_log;
  IF v_oldest < now() - interval '6 months 2 days' THEN
    check_name := 'purge_stalled';
    detail := 'linha_mais_antiga=' || v_oldest::text;
    RETURN NEXT;
  END IF;

  -- (e) erros de captura nas últimas 24 h (a mensagem fica no banco, não sai daqui).
  SELECT count(*), max(ran_at) INTO v_errors, v_last_error
    FROM private.access_log_runs
   WHERE job = 'capture_error' AND ran_at > now() - interval '24 hours';
  IF v_errors > 0 THEN
    check_name := 'capture_errors';
    detail := 'erros_24h=' || v_errors || '; ultimo=' || v_last_error::text;
    RETURN NEXT;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.access_log_health() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.access_log_health() FROM anon;
REVOKE EXECUTE ON FUNCTION public.access_log_health() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.access_log_health() TO service_role;

-- 5. Purge diário (FR-003). Intervalo fixo no corpo: nenhum parâmetro vem de fora.
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

-- 6. Agendamento por último (ADR-077).
SELECT cron.schedule(
  'prune-access-log',
  '45 3 * * *',
  $$ SELECT private.purge_access_log() $$
);

-- Reversão (desligar a coleta em 1 comando: a primeira linha basta).
--   ⚠️ `ALTER TABLE auth.sessions DISABLE TRIGGER` NÃO funciona: exige ser dono da tabela
--   (supabase_auth_admin) — medido no dry-run de 2026-10-20 (42501). `DROP TRIGGER` funciona com o
--   privilégio TRIGGER que o `postgres` tem.
--   DROP TRIGGER IF EXISTS trg_access_log_capture ON auth.sessions;
--   SELECT cron.unschedule('prune-access-log');
--   DROP FUNCTION IF EXISTS public.access_log_health();
--   DROP FUNCTION IF EXISTS private.purge_access_log();
--   DROP FUNCTION IF EXISTS private.capture_access_log();
--   As tabelas FICAM: o conteúdo está sob obrigação legal de guarda (Marco Civil art. 15).
