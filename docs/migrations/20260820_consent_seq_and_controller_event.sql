-- 20260820_consent_seq_and_controller_event.sql — 046 Slice C / T013e + T013a
--
-- ✅ APLICADA EM PRODUÇÃO em 2026-08-20 (MCP `apply_migration`), com o `.test.sql` rodado bloco a
--    bloco em seguida. `database.types.ts` regenerado no mesmo movimento (R-289).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. T013e — POR QUE `created_at` NÃO BASTA PARA DIZER QUAL FOI O ÚLTIMO ATO
-- ─────────────────────────────────────────────────────────────────────────────
-- `consent_write` decide o anti-flood lendo o ÚLTIMO evento do titular, e o prune (Slice C)
-- decide se APAGA UMA CONTA lendo a mesma coisa. Ambos ordenavam por `created_at DESC LIMIT 1`.
--
-- Dentro de UMA transação, `now()` é constante: dois eventos gravados na mesma txn empatam em
-- `created_at`, e `ORDER BY created_at DESC LIMIT 1` passa a devolver QUALQUER UM DOS DOIS — o
-- Postgres não promete ordem em empate. Se o empate for entre `granted` e `revoked`, o prune pode
-- ler `revoked` onde o titular acabou de consentir. O modo de falha é apagar a conta de quem
-- consentiu — irreversível, sem erro, sem teste vermelho.
--
-- Em produção os atos do titular chegam em transações separadas (empate improvável), mas backfill,
-- testes e qualquer batch futuro disparam o caso. A correção é uma chave de desempate MONOTÔNICA.
--
-- `id` (uuid v4) NÃO serve: desempata de forma determinística, porém ARBITRÁRIA — conserta o flake
-- do teste e não o risco. `seq` (IDENTITY) ordena por ordem real de inserção.
--
-- ⚠️ Linhas pré-existentes recebem `seq` na ordem física em que o Postgres as varre — o que NÃO
-- reconstrói a ordem histórica real. É aceitável porque (a) a tabela é append-only e pequena, e
-- (b) verificado em prod nesta data: ZERO empates de (user_id, consent_type, created_at). O `seq`
-- passa a valer como desempate para o que vier a partir daqui.
--
-- ⚠️ GRANT DE COLUNA (AP-275 / S4): `consent_log` usa grants POR COLUNA. Coluna nova NÃO herda
-- nada — sem o GRANT abaixo, `service_role` levaria *permission denied* ao selecionar `seq`.
-- `authenticated` NÃO recebe `seq` de propósito: é um contador global e diria ao titular quantos
-- eventos de consentimento existem no sistema inteiro. O client não precisa — ver
-- `deriveConsentState`, que desempata por `id` quando `seq` não vem.
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. T013a — POR QUE O JOB DO PRUNE PRECISA DE UMA RPC (E O PEPPER NÃO SAI DAQUI)
-- ─────────────────────────────────────────────────────────────────────────────
-- O job grava `notice_sent`/`pruned`, e `consent_log.subject_hash` é NOT NULL. O plano original
-- previa copiar o pepper para um env da Vercel para o Node computar o HMAC. Isso está CANCELADO
-- (AP-293): duplicar o pepper num env de aplicação recria, do lado do Node, exatamente a exposição
-- que o Slice A removeu do lado do banco — e pepper vazado REIDENTIFICA os titulares já excluídos,
-- que são justamente os que mais dependem dessa proteção.
--
-- Em vez disso, o hash é derivado DENTRO do banco, como o recibo de exclusão já faz. O Node manda
-- `user_id` e recebe `id`; nunca vê o pepper, e nenhum env novo é criado.
--
-- ⚠️ A guarda é `auth.role()`, NUNCA `current_user` (AP-292): dentro de SECURITY DEFINER,
-- `current_user` é sempre o OWNER da função, então uma guarda de `current_user` nasce INERTE.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Chave monotônica de desempate
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.consent_log
  ADD COLUMN IF NOT EXISTS seq bigint GENERATED ALWAYS AS IDENTITY;

COMMENT ON COLUMN public.consent_log.seq IS
  'Ordem de inserção. Desempata `created_at` (constante dentro de uma txn) ao eleger o último ato '
  'do titular — o SELECT que decide o prune. Ver T013e (spec 046).';

-- O prune varre (user_id, consent_type) e quer o último ato: o índice serve o ORDER BY novo.
CREATE INDEX IF NOT EXISTS idx_consent_log_user_type_seq
  ON public.consent_log (user_id, consent_type, seq DESC);

-- Grant POR COLUNA — coluna nova não herda (AP-275). `authenticated` fica de fora de propósito.
GRANT SELECT (seq) ON public.consent_log TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. `consent_write` — mesmo corpo, ordenação estável
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consent_write(p_action text, p_consent_type text, p_platform text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text; v_policy_version text; v_last_id uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_action NOT IN ('granted','revoked') THEN RAISE EXCEPTION 'consent_action_not_allowed'; END IF;
  IF p_consent_type NOT IN ('health_data','terms_privacy') THEN RAISE EXCEPTION 'consent_type_invalid'; END IF;
  IF p_platform NOT IN ('web','mobile','server') THEN RAISE EXCEPTION 'consent_platform_invalid'; END IF;

  -- T013e: `seq DESC` (era `created_at DESC`) — empate de timestamp elegia um evento arbitrário.
  SELECT c.id INTO v_last_id FROM public.consent_log c
   WHERE c.user_id = v_uid AND c.consent_type = p_consent_type
   ORDER BY c.seq DESC LIMIT 1;

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

  IF p_consent_type = 'health_data' THEN
    INSERT INTO public.user_settings (user_id, consent_revoked_at)
    VALUES (v_uid, CASE WHEN p_action = 'revoked' THEN now() ELSE NULL END)
    ON CONFLICT (user_id) DO UPDATE
      SET consent_revoked_at = CASE WHEN p_action = 'revoked' THEN now() ELSE NULL END;
  END IF;

  RETURN v_id;
END; $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. `consent_controller_event` — atos do CONTROLADOR (T013a)
-- ─────────────────────────────────────────────────────────────────────────────
-- Só `notice_sent` e `pruned`. `granted`/`revoked` são atos do TITULAR e continuam exclusivos do
-- `consent_write` (que os deriva de `auth.uid()`): se o controlador pudesse gravá-los, a trilha
-- perderia justamente a propriedade que a torna prova — ninguém pode fabricar a vontade do outro.
-- `account_deleted` também não entra: já é emitido dentro de `_delete_user_account_core`, na mesma
-- transação da exclusão, que é o único instante em que o e-mail ainda existe para derivar o hash.
CREATE OR REPLACE FUNCTION public.consent_controller_event(
  p_user_id uuid,
  p_action text,
  p_consent_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller text := auth.role();   -- AP-292: `current_user` aqui seria sempre o OWNER = guarda inerte
  v_email text;
  v_policy_version text;
  v_id uuid;
BEGIN
  IF v_caller IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'consent_subject_missing'; END IF;
  IF p_action NOT IN ('notice_sent','pruned') THEN RAISE EXCEPTION 'consent_action_not_allowed'; END IF;
  IF p_consent_type NOT IN ('health_data','terms_privacy') THEN RAISE EXCEPTION 'consent_type_invalid'; END IF;

  -- O e-mail é a única fonte do `subject_hash`. Conta já excluída ⇒ não há o que carimbar: falha
  -- alto em vez de inventar um hash — a linha órfã seria uma prova que não prova nada.
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'consent_subject_email_missing'; END IF;

  -- Informativo: o CHECK só exige versão em granted/revoked. Registra sob qual política o
  -- controlador agiu; ausência não bloqueia o ato do controlador.
  SELECT p.version INTO v_policy_version FROM public.consent_policy p WHERE p.id = 1;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (p_user_id, public.consent_subject_hash(v_email), p_consent_type, p_action, v_policy_version, 'server')
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$;

-- PUBLIC é o default do Postgres para EXECUTE — revogar ANTES de qualquer GRANT (AP-278).
REVOKE EXECUTE ON FUNCTION public.consent_controller_event(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consent_controller_event(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consent_controller_event(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consent_controller_event(uuid, text, text) TO service_role;

COMMENT ON FUNCTION public.consent_controller_event(uuid, text, text) IS
  'Atos do CONTROLADOR na trilha (notice_sent/pruned) — 046 Slice C/T013a. service_role only. '
  'Deriva subject_hash dentro do banco para que o pepper NUNCA saia do Postgres (AP-293).';

COMMIT;
