-- 20261021_096_consent_policy_v04.sql — spec 096 Slice B2 (T038; absorve T026). ADR-112.
--
-- Migração ÚNICA da v0.4. Aplicada SÓ no Dia D, depois do curl da política v0.4 em produção
-- (PO-SEC-3) e antes do merge de `feature/096-b-release` (INV-3/INV-4: constante, HTML e banco no
-- mesmo release).
--
-- O QUE FAZ
--   1. Tipo novo `international_transfer` (art. 33, VIII — caixa B) no CHECK de
--      `consent_log.consent_type` E na whitelist da `consent_write` (R-271: os dois juntos — o CHECK
--      sozinho deixaria a RPC recusar com `consent_type_invalid`).
--   2. Flag operacional `user_settings.international_transfer_granted_at`, escrito SÓ pela
--      `consent_write` na mesma txn do evento (grant ⇒ now(), revoke ⇒ NULL). Lido pelo dispatcher,
--      pela Live Activity e pelo chatbot (modo sem B, ADR-112). Guard trigger no espelho de
--      `consent_revoked_at` (20260714_consent_revoked_flag.sql).
--   3. `consent_policy` → '0.4' + REVOKE de escrita de anon/authenticated (FR-015 / PO-SEC-1).
--
-- R-270 PREFLIGHT (failure modes) — tabela completa em analysis-B2.md §5:
--   - Sem backfill: todo mundo começa SEM B (flag NULL ⇒ redige). Direção segura: redigir não cala
--     alerta clínico, só tira o nome.
--   - Linha de user_settings ausente ⇒ o upsert da RPC cria (mesmo caminho do flag de A).
--   - grant/revoke de A não toca o flag de B e vice-versa (CASE por tipo).
--   - CHECK novo é superset do antigo ⇒ linhas existentes validam.
--   - authenticated limpando/preenchendo o próprio flag via PostgREST ⇒ trigger INVOKER bloqueia
--     (AP-292: DEFINER deixaria a guarda inerte).
--   - TRUNCATE em consent_policy ignora RLS ⇒ o REVOKE é necessário de fato, não só cosmético.
--
-- R-295: corpo da consent_write = pg_get_functiondef de PRODUÇÃO (2026-10-21: ordena por `seq`,
-- upsert do flag de A). Único delta: whitelist + bloco do flag de B.

BEGIN;

-- ─── 1. Tipo novo no CHECK ──────────────────────────────────────────────────────────────────
ALTER TABLE public.consent_log DROP CONSTRAINT consent_log_consent_type_check;
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_consent_type_check
  CHECK (consent_type = ANY (ARRAY['health_data'::text, 'terms_privacy'::text, 'international_transfer'::text]));

-- ─── 2. Flag de B ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS international_transfer_granted_at timestamptz;

COMMENT ON COLUMN public.user_settings.international_transfer_granted_at IS
  'Spec 096 / ADR-112: instante do aceite vigente de international_transfer (caixa B). NULL = sem B '
  '⇒ servidor redige push/LA e recusa o chatbot. Índice OPERACIONAL derivado de consent_log, escrito '
  'na mesma txn por public.consent_write. NUNCA escrever direto — trg_user_settings_transfer_flag bloqueia.';

-- Guard INVOKER (AP-292): `current_user` é a role do cliente via PostgREST e o OWNER dentro da
-- consent_write (DEFINER) — bloqueia o titular, libera a RPC.
CREATE OR REPLACE FUNCTION public.guard_transfer_granted_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.international_transfer_granted_at IS DISTINCT FROM OLD.international_transfer_granted_at
     AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'international_transfer_granted_at_is_controller_owned';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_transfer_granted_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_transfer_granted_at() FROM anon;

DROP TRIGGER IF EXISTS trg_user_settings_transfer_flag ON public.user_settings;
CREATE TRIGGER trg_user_settings_transfer_flag
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_transfer_granted_at();

CREATE OR REPLACE FUNCTION public.guard_transfer_granted_at_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.international_transfer_granted_at IS NOT NULL AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'international_transfer_granted_at_is_controller_owned';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_transfer_granted_at_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_transfer_granted_at_insert() FROM anon;

DROP TRIGGER IF EXISTS trg_user_settings_transfer_flag_ins ON public.user_settings;
CREATE TRIGGER trg_user_settings_transfer_flag_ins
  BEFORE INSERT ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_transfer_granted_at_insert();

-- ─── 3. consent_write: whitelist + flag de B na mesma txn ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.consent_write(p_action text, p_consent_type text, p_platform text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text; v_policy_version text; v_last_id uuid; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_action NOT IN ('granted','revoked') THEN RAISE EXCEPTION 'consent_action_not_allowed'; END IF;
  IF p_consent_type NOT IN ('health_data','terms_privacy','international_transfer') THEN RAISE EXCEPTION 'consent_type_invalid'; END IF;
  IF p_platform NOT IN ('web','mobile','server') THEN RAISE EXCEPTION 'consent_platform_invalid'; END IF;

  -- T013e: `seq DESC` (era `created_at DESC`).
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

  -- 096 / ADR-112: flag operacional de B (modo sem B no servidor).
  IF p_consent_type = 'international_transfer' THEN
    INSERT INTO public.user_settings (user_id, international_transfer_granted_at)
    VALUES (v_uid, CASE WHEN p_action = 'granted' THEN now() ELSE NULL END)
    ON CONFLICT (user_id) DO UPDATE
      SET international_transfer_granted_at = CASE WHEN p_action = 'granted' THEN now() ELSE NULL END;
  END IF;

  RETURN v_id;
END; $function$;

REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.consent_write(text, text, text) FROM service_role;

-- ─── 4. Política 0.4 + REVOKE de escrita (FR-015 / PO-SEC-1) ────────────────────────────────
UPDATE public.consent_policy SET version = '0.4', updated_at = now() WHERE id = 1;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.consent_policy FROM anon, authenticated;
GRANT SELECT ON public.consent_policy TO anon, authenticated;

COMMIT;
