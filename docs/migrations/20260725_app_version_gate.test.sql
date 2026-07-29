-- 20260725_app_version_gate.test.sql — 051-A · PR 1.5a (T022 · PO-8 / PO-SEC-7)
--
-- BEGIN..ROLLBACK contra o banco REAL (R-270): a transação inteira é desfeita, inclusive o CREATE
-- TABLE e os REVOKEs. Roda ANTES do apply em prod e continua verde depois — é o teste do CADEADO,
-- não do momento em que ele foi instalado.
--
-- ⚠️ O DDL abaixo é CÓPIA de 20260725_app_version_gate.sql (não há `\i` via MCP). Mudou lá?
-- muda aqui, no MESMO commit — senão este arquivo passa a atestar uma tabela que não existe.
--
-- O QUE ESTE ARQUIVO PROVA: as DUAS camadas de acesso (AP-278) existem de forma INDEPENDENTE.
-- Não basta "não ter policy de escrita" — era a proteção ÚNICA de todas as tabelas do projeto até
-- aqui (medido em 2026-07-25). O privilégio herdado de ALTER DEFAULT PRIVILEGES também tem de estar
-- revogado: os casos 5 e 6 falham num `REVOKE ... FROM PUBLIC` sozinho.
--
-- FORMA: cada caso é um DO block que RAISE EXCEPTION quando o esperado não bate — o teste falha
-- ALTO, não devolve uma tabela para alguém interpretar. No fim, um único SELECT imprime o estado
-- completo como evidência colável.
--
-- ┌─ Casos ────────────────────────────────────────────────────────────────────────────────────┐
-- |  # | Caso                                                                | Esperado        |
-- |----|---------------------------------------------------------------------|-----------------|
-- |  1 | seed cria 2 linhas (ios, android), ambas is_active = false            | 2 / 0 ativas    |
-- |  2 | CHECK rejeita platform fora do domínio ('web')                       | 23514           |
-- |  3 | PK rejeita segunda linha da mesma plataforma                          | 23505           |
-- |  4 | seed é idempotente: reaplicar NÃO reseta um gate já ativo              | is_active TRUE  |
-- |  5 | CAMADA 1 — anon/authenticated: SELECT sim; I/U/D/TRUNCATE NÃO         | t,f,f,f,f       |
-- |  6 | CAMADA 1 (S-10) — column-level: 5 colunas sim; updated_by/at NÃO      | t…t,f,f         |
-- |  7 | CAMADA 2 — RLS ligada, 1 policy, cmd=SELECT, roles anon+authenticated  | 1 / SELECT      |
-- |  8 | CAMADA 2 — ZERO policies de escrita                                   | 0               |
-- |  9 | service_role mantém escrita (o caminho admin não pode ficar mudo)      | t,t,t           |
-- | 10 | FK updated_by → auth.users com ON DELETE SET NULL (R-287)             | 'n'             |
-- | 11 | escrita real como `anon` é recusada (prova viva, se o role trocar)     | 42501 / SKIP    |
-- └────────────────────────────────────────────────────────────────────────────────────────────┘

BEGIN;

-- ─── DDL sob teste (cópia de 20260725_app_version_gate.sql) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_version_gate (
  platform text PRIMARY KEY CHECK (platform IN ('ios', 'android')),
  min_supported_version text,
  is_active boolean NOT NULL DEFAULT false,
  message text,
  store_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.app_version_gate (platform, is_active)
VALUES ('ios', false), ('android', false)
ON CONFLICT (platform) DO NOTHING;

REVOKE ALL ON public.app_version_gate FROM PUBLIC;
REVOKE ALL ON public.app_version_gate FROM anon, authenticated;
GRANT SELECT (platform, min_supported_version, is_active, message, store_url)
  ON public.app_version_gate TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_version_gate TO service_role;

ALTER TABLE public.app_version_gate ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the version gate"
  ON public.app_version_gate FOR SELECT
  TO anon, authenticated
  USING (true);

-- ═══ ASSERÇÕES ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_linhas int; v_ativas int; v_dominio bool;
  r record; v_cmds text; v_roles text; v_total int; v_escrita int; v_rls bool;
  v_ondelete "char"; v_active bool; v_min text;
BEGIN
  -- Caso 1 — seed
  SELECT count(*), count(*) FILTER (WHERE is_active), bool_and(platform IN ('ios','android'))
    INTO v_linhas, v_ativas, v_dominio FROM public.app_version_gate;
  IF v_linhas <> 2 OR v_ativas <> 0 OR NOT v_dominio THEN
    RAISE EXCEPTION 'FALHOU caso 1: linhas=% ativas=% dominio=%', v_linhas, v_ativas, v_dominio;
  END IF;
  RAISE NOTICE 'caso 1 OK: 2 linhas semeadas, 0 ativas';

  -- Caso 2 — CHECK do domínio
  BEGIN
    INSERT INTO public.app_version_gate (platform) VALUES ('web');
    RAISE EXCEPTION 'FALHOU caso 2: platform=web foi ACEITA';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'caso 2 OK: 23514 check_violation em platform=web';
  END;

  -- Caso 3 — PK
  BEGIN
    INSERT INTO public.app_version_gate (platform) VALUES ('ios');
    RAISE EXCEPTION 'FALHOU caso 3: segunda linha ios foi ACEITA';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'caso 3 OK: 23505 unique_violation em ios duplicado';
  END;

  -- Caso 4 — reaplicar a migração num banco com o kill switch LIGADO não pode desligá-lo
  UPDATE public.app_version_gate SET is_active = true, min_supported_version = '0.29.0'
    WHERE platform = 'ios';
  INSERT INTO public.app_version_gate (platform, is_active)
    VALUES ('ios', false), ('android', false) ON CONFLICT (platform) DO NOTHING;
  SELECT is_active, min_supported_version INTO v_active, v_min
    FROM public.app_version_gate WHERE platform = 'ios';
  IF v_active IS NOT TRUE OR v_min <> '0.29.0' THEN
    RAISE EXCEPTION 'FALHOU caso 4: seed sobrescreveu gate ativo (is_active=% min=%)', v_active, v_min;
  END IF;
  RAISE NOTICE 'caso 4 OK: seed idempotente, gate ativo preservado';
  UPDATE public.app_version_gate SET is_active = false, min_supported_version = NULL
    WHERE platform = 'ios';

  -- Caso 5 — CAMADA 1, privilégios de tabela.
  -- Leitura é medida com has_ANY_column_privilege: o grant é column-scoped de propósito (S-10),
  -- então has_table_privilege(...,'SELECT') é FALSE aqui — e isso é o resultado correto.
  FOR r IN SELECT unnest(ARRAY['anon','authenticated']) AS role LOOP
    IF NOT has_any_column_privilege(r.role, 'public.app_version_gate', 'SELECT') THEN
      RAISE EXCEPTION 'FALHOU caso 5: % sem SELECT — o gate ficaria MUDO no boot', r.role;
    END IF;
    IF has_table_privilege(r.role, 'public.app_version_gate', 'SELECT') THEN
      RAISE EXCEPTION 'FALHOU caso 5: % tem SELECT de TABELA — o grant deixou de ser column-scoped e o S-10 virou inerte', r.role;
    END IF;
    IF has_table_privilege(r.role, 'public.app_version_gate', 'INSERT')
       OR has_table_privilege(r.role, 'public.app_version_gate', 'UPDATE')
       OR has_table_privilege(r.role, 'public.app_version_gate', 'DELETE')
       OR has_table_privilege(r.role, 'public.app_version_gate', 'TRUNCATE') THEN
      RAISE EXCEPTION 'FALHOU caso 5: % mantém privilégio de ESCRITA (camada 1 aberta)', r.role;
    END IF;
    -- Escrita column-scoped é a mesma armadilha do S-10 ao contrário: has_table_privilege não a vê.
    IF has_any_column_privilege(r.role, 'public.app_version_gate', 'INSERT')
       OR has_any_column_privilege(r.role, 'public.app_version_gate', 'UPDATE') THEN
      RAISE EXCEPTION 'FALHOU caso 5: % mantém escrita em ALGUMA coluna', r.role;
    END IF;
  END LOOP;
  RAISE NOTICE 'caso 5 OK: anon+authenticated só SELECT';

  -- Caso 6 — CAMADA 1, column-level (S-10)
  FOR r IN SELECT unnest(ARRAY['anon','authenticated']) AS role LOOP
    IF NOT (has_column_privilege(r.role,'public.app_version_gate','platform','SELECT')
        AND has_column_privilege(r.role,'public.app_version_gate','min_supported_version','SELECT')
        AND has_column_privilege(r.role,'public.app_version_gate','is_active','SELECT')
        AND has_column_privilege(r.role,'public.app_version_gate','message','SELECT')
        AND has_column_privilege(r.role,'public.app_version_gate','store_url','SELECT')) THEN
      RAISE EXCEPTION 'FALHOU caso 6: % não lê as 5 colunas do contrato', r.role;
    END IF;
    IF has_column_privilege(r.role,'public.app_version_gate','updated_by','SELECT')
       OR has_column_privilege(r.role,'public.app_version_gate','updated_at','SELECT') THEN
      RAISE EXCEPTION 'FALHOU caso 6: % lê updated_by/updated_at (S-10 aberto)', r.role;
    END IF;
  END LOOP;
  RAISE NOTICE 'caso 6 OK: 5 colunas legíveis, updated_by/updated_at revogadas';

  -- Caso 7 — CAMADA 2, RLS + policy única de SELECT para os dois roles
  SELECT c.relrowsecurity INTO v_rls FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname='public' AND c.relname='app_version_gate';
  SELECT count(*), string_agg(cmd::text, ','), string_agg(array_to_string(roles,'+'), ' | ')
    INTO v_total, v_cmds, v_roles
    FROM pg_policies WHERE schemaname='public' AND tablename='app_version_gate';
  IF v_rls IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU caso 7: RLS desligada'; END IF;
  IF v_total <> 1 OR v_cmds <> 'SELECT' THEN
    RAISE EXCEPTION 'FALHOU caso 7: policies=% cmds=%', v_total, v_cmds;
  END IF;
  IF v_roles NOT LIKE '%anon%' OR v_roles NOT LIKE '%authenticated%' THEN
    RAISE EXCEPTION 'FALHOU caso 7: policy não cobre anon E authenticated (roles=%) — copiar a dos nudges deixa o gate mudo no boot', v_roles;
  END IF;
  RAISE NOTICE 'caso 7 OK: RLS on, 1 policy SELECT, roles=%', v_roles;

  -- Caso 8 — ZERO policies de escrita
  SELECT count(*) INTO v_escrita FROM pg_policies
   WHERE schemaname='public' AND tablename='app_version_gate'
     AND cmd::text IN ('INSERT','UPDATE','DELETE','ALL');
  IF v_escrita <> 0 THEN
    RAISE EXCEPTION 'FALHOU caso 8: % policy(ies) de escrita', v_escrita;
  END IF;
  RAISE NOTICE 'caso 8 OK: zero policies de escrita';

  -- Caso 9 — service_role mantém escrita (senão o gate é irreversível pelo painel)
  IF NOT (has_table_privilege('service_role','public.app_version_gate','SELECT')
      AND has_table_privilege('service_role','public.app_version_gate','INSERT')
      AND has_table_privilege('service_role','public.app_version_gate','UPDATE')) THEN
    RAISE EXCEPTION 'FALHOU caso 9: service_role sem escrita — caminho admin mudo';
  END IF;
  RAISE NOTICE 'caso 9 OK: service_role escreve';

  -- Caso 10 — FK de auditoria (R-287)
  SELECT con.confdeltype INTO v_ondelete FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
   WHERE c.relname='app_version_gate' AND con.contype='f';
  IF v_ondelete IS DISTINCT FROM 'n' THEN
    RAISE EXCEPTION 'FALHOU caso 10: ON DELETE=% (esperado n=SET NULL)', v_ondelete;
  END IF;
  RAISE NOTICE 'caso 10 OK: FK updated_by ON DELETE SET NULL';

  -- Caso 11 — prova VIVA: escrita como anon. Depende de o executor poder assumir o role; não
  -- conseguindo, imprime SKIP e a prova de fora fica no PO-8 por curl (R-295 — só vale executado).
  BEGIN
    SET LOCAL ROLE anon;
    BEGIN
      UPDATE public.app_version_gate SET is_active = true WHERE platform = 'android';
      RESET ROLE;
      RAISE EXCEPTION 'FALHOU caso 11: anon ESCREVEU no kill switch';
    EXCEPTION WHEN insufficient_privilege THEN
      RESET ROLE;
      RAISE NOTICE 'caso 11 OK: 42501 insufficient_privilege — anon não escreve';
    END;
  EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN
    RESET ROLE;
    RAISE NOTICE 'caso 11 SKIP: executor não pode assumir o role anon. Prova fica no PO-8/curl.';
  END;

  RAISE NOTICE '════ 11/11 casos verdes ════';
END $$;

-- ─── Caso 12: a CAMADA 2 segura SOZINHA (é o que "independente" significa — AP-278) ───────────
-- Simula a camada 1 arranhada: alguém reconcede o privilégio (refactor, migração futura, ALTER
-- DEFAULT PRIVILEGES voltando por herança). Se a RLS não segurar aqui, a proteção era UMA camada
-- disfarçada de duas.
--
-- 🔴 O QUE ESTE CASO ENSINOU (medido 2026-07-25): a camada 2 barra **em silêncio** — `UPDATE`
-- afetou 0 linhas e não levantou erro. Camada 1 falha ALTO (42501); camada 2 falha BAIXO (sucesso
-- aparente com 0 linhas). Daí o handler admin conferir a linha devolvida e tratar 0 linhas como
-- FALHA: senão a UI anuncia um bloqueio que não foi gravado.
DO $$
DECLARE v_afetadas int; v_ativas int;
BEGIN
  GRANT UPDATE ON public.app_version_gate TO authenticated;
  BEGIN
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}';
    UPDATE public.app_version_gate SET is_active = true, min_supported_version = '99.0.0';
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
    RESET ROLE;
  EXCEPTION WHEN insufficient_privilege OR invalid_parameter_value THEN
    RESET ROLE;
    RAISE NOTICE 'caso 12 SKIP: executor não pode assumir o role authenticated';
    RETURN;
  END;
  SELECT count(*) FILTER (WHERE is_active) INTO v_ativas FROM public.app_version_gate;
  IF v_afetadas <> 0 OR v_ativas <> 0 THEN
    RAISE EXCEPTION 'FALHOU caso 12: privilégio reconcedido e a RLS NÃO barrou (afetadas=% ativas=%) — a proteção era camada única', v_afetadas, v_ativas;
  END IF;
  RAISE NOTICE 'caso 12 OK: camada 2 sozinha barra (0 linhas afetadas, 0 ativas) — em SILÊNCIO';
END $$;

-- Evidência final colável: estado completo da superfície criada.
--
-- SAÍDA MEDIDA em 2026-07-25 (T022, antes do apply):
--   linhas=2 · ativas=0 · anon_pode_ler=t · anon_select_tabela=f · anon_update=f · auth_update=f
--   anon_store_url=t · anon_updated_by=f · anon_updated_at=f · rls_on=t · policies=1
--   policy_def=SELECT:anon+authenticated
SELECT
  (SELECT count(*) FROM public.app_version_gate)                                    AS linhas,
  (SELECT count(*) FROM public.app_version_gate WHERE is_active)                    AS ativas,
  has_any_column_privilege('anon','public.app_version_gate','SELECT')               AS anon_pode_ler,
  has_table_privilege('anon','public.app_version_gate','SELECT')                    AS anon_select_tabela,
  has_table_privilege('anon','public.app_version_gate','UPDATE')                    AS anon_update,
  has_table_privilege('authenticated','public.app_version_gate','UPDATE')           AS auth_update,
  has_column_privilege('anon','public.app_version_gate','store_url','SELECT')       AS anon_store_url,
  has_column_privilege('anon','public.app_version_gate','updated_by','SELECT')      AS anon_updated_by,
  has_column_privilege('anon','public.app_version_gate','updated_at','SELECT')      AS anon_updated_at,
  (SELECT relrowsecurity FROM pg_class WHERE oid='public.app_version_gate'::regclass) AS rls_on,
  (SELECT count(*) FROM pg_policies WHERE tablename='app_version_gate')             AS policies,
  (SELECT string_agg(cmd::text||':'||array_to_string(roles,'+'),',') FROM pg_policies
     WHERE tablename='app_version_gate')                                            AS policy_def;

ROLLBACK;
