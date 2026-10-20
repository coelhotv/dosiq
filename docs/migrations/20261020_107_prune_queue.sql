-- Spec 107 — Aprovação manual do prune + lápide do Marco Civil. ADR-111.
-- 1. public.prune_queue / prune_queue_audit: fila de exclusão com decisão humana conta a conta.
-- 2. consent_log ganha o ato do controlador `scheduled_deletion` (CHECK + allowlist da RPC).
-- 3. public.consent_copy (+ histórico): texto da trava do app, editável no admin (FR-010).
-- 4. RPCs: get_my_deletion_notice (titular), prune_unconsented_accounts, prune_account_emails (service).
-- 5. private.account_tombstone + _delete_user_account_core grava a lápide (FR-013, INV-7)
--    + private.purge_access_log purga a lápide junto do access_log (6 meses).
--
-- Aplicado via Supabase MCP (apply_migration) após dry-run BEGIN..ROLLBACK do .test.sql.
--
-- R-270 — Failure Modes:
--   eligible_at/scheduled_at NULL      → NOT NULL na coluna.
--   reason/decision fora do domínio     → CHECK.
--   approved sem decided_by             → CHECK prune_queue_decided_chk.
--   deferred sem nota/reevaluate_at     → CHECK prune_queue_deferred_chk (nota só com espaço barrada).
--   executed_at fora de approved        → CHECK prune_queue_executed_chk.
--   2 linhas vivas por titular          → unique parcial (user_id) WHERE vivo; void/executada fora.
--   conta apagada                       → user_id SEM FK (G-1): o uuid fica como prova pseudônima.
--   ping duplo do executor              → o Node marca com UPDATE … WHERE executed_at IS NULL.
--   corpo do core reescrito de memória  → S-9: corpo abaixo é pg_get_functiondef de 2026-10-20 +
--                                         só o INSERT da lápide; o .test.sql confere cada DELETE.
--   lápide falha                        → mesma transação: a exclusão inteira volta (INV-7).
--   exclusão repetida do mesmo uuid     → 2ª chamada cai em user_not_found antes da lápide.
--   texto da trava inválido             → CHECK de tamanho + `{data}` exatamente 1×; Zod repete (PO-SEC-3).
--   S-3/AP-275 toda função revoga EXECUTE de PUBLIC/anon nomeado; service-only checa auth.role().
--   S-10 lápide em `private` (nenhum papel de API tem USAGE — verificado 2026-10-20).

-- ─── 1. Fila ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.prune_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  reason        text NOT NULL CHECK (reason IN ('revoked_90d','legacy_no_consent','onboarding_no_consent')),
  scheduled_at  timestamptz NOT NULL,
  eligible_at   timestamptz NOT NULL,
  decision      text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','approved','deferred','void')),
  decided_at    timestamptz,
  decided_by    uuid,
  note          text,
  reevaluate_at timestamptz,
  executed_at   timestamptz,
  void_reason   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prune_queue_clock_chk    CHECK (eligible_at > scheduled_at),
  CONSTRAINT prune_queue_decided_chk  CHECK (decision NOT IN ('approved','deferred') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)),
  CONSTRAINT prune_queue_deferred_chk CHECK (decision <> 'deferred' OR (length(btrim(note)) > 0 AND reevaluate_at IS NOT NULL)),
  CONSTRAINT prune_queue_executed_chk CHECK (executed_at IS NULL OR decision = 'approved'),
  CONSTRAINT prune_queue_void_chk     CHECK (decision <> 'void' OR length(btrim(void_reason)) > 0)
);
CREATE UNIQUE INDEX prune_queue_one_live_per_user
  ON public.prune_queue (user_id)
  WHERE decision IN ('pending','approved','deferred') AND executed_at IS NULL;
CREATE INDEX prune_queue_eligible_idx ON public.prune_queue (eligible_at) WHERE executed_at IS NULL;

CREATE TABLE public.prune_queue_audit (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  queue_id   uuid REFERENCES public.prune_queue(id) ON DELETE RESTRICT,
  user_id    uuid NOT NULL,
  action     text NOT NULL CHECK (action IN ('enqueue','approve','defer','void','execute','reveal_email','mark_notice')),
  actor      text NOT NULL CHECK (length(btrim(actor)) > 0),
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prune_queue_audit_user_idx ON public.prune_queue_audit (user_id, action);

ALTER TABLE public.prune_queue       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prune_queue_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.prune_queue, public.prune_queue_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.prune_queue TO service_role;
GRANT SELECT, INSERT ON public.prune_queue_audit TO service_role;

-- ─── 2. Ato do controlador `scheduled_deletion` ─────────────────────────────────────────────
ALTER TABLE public.consent_log DROP CONSTRAINT consent_log_action_check;
ALTER TABLE public.consent_log ADD CONSTRAINT consent_log_action_check
  CHECK (action = ANY (ARRAY['granted','revoked','notice_sent','pruned','account_deleted','scheduled_deletion']));

CREATE OR REPLACE FUNCTION public.consent_controller_event(p_user_id uuid, p_action text, p_consent_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_caller text := auth.role();   -- AP-292: current_user aqui seria sempre o OWNER = guarda inerte
  v_email text;
  v_policy_version text;
  v_id uuid;
BEGIN
  IF v_caller IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'consent_subject_missing'; END IF;
  -- 107: `scheduled_deletion` = o controlador marcou a conta para exclusão (nunca `revoked`, INV-3).
  IF p_action NOT IN ('notice_sent','pruned','scheduled_deletion') THEN RAISE EXCEPTION 'consent_action_not_allowed'; END IF;
  IF p_consent_type NOT IN ('health_data','terms_privacy') THEN RAISE EXCEPTION 'consent_type_invalid'; END IF;

  -- O e-mail é a única fonte do subject_hash. Conta já excluída ⇒ falha alto em vez de inventar
  -- um hash: a linha órfã seria uma prova que não prova nada.
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'consent_subject_email_missing'; END IF;

  SELECT p.version INTO v_policy_version FROM public.consent_policy p WHERE p.id = 1;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (p_user_id, public.consent_subject_hash(v_email), p_consent_type, p_action, v_policy_version, 'server')
  RETURNING id INTO v_id;

  RETURN v_id;
END; $function$;

-- ─── 3. Texto da trava (FR-010) ─────────────────────────────────────────────────────────────
CREATE TABLE public.consent_copy (
  key        text PRIMARY KEY CHECK (key IN ('never_consented_deadline')),
  body       text NOT NULL,
  version    integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_copy_body_chk CHECK (
    char_length(body) BETWEEN 20 AND 600
    AND (char_length(body) - char_length(replace(body, '{data}', ''))) = 6
  )
);
CREATE TABLE public.consent_copy_history (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        text NOT NULL,
  body       text NOT NULL,
  version    integer NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL
);
ALTER TABLE public.consent_copy         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_copy_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consent_copy, public.consent_copy_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.consent_copy TO authenticated;
CREATE POLICY consent_copy_read ON public.consent_copy FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE ON public.consent_copy TO service_role;
GRANT SELECT, INSERT ON public.consent_copy_history TO service_role;

INSERT INTO public.consent_copy (key, body) VALUES (
  'never_consented_deadline',
  'Para guardar e organizar suas informações, o dosiq precisa que você autorize o uso desses dados. Sem essa autorização, sua conta e tudo o que está nela serão excluídos em {data}.'
);

-- ─── 4. RPCs ────────────────────────────────────────────────────────────────────────────────
-- Titular: só a própria data, só para quem nunca consentiu (legado/onboarding).
CREATE OR REPLACE FUNCTION public.get_my_deletion_notice()
 RETURNS timestamptz
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT q.eligible_at FROM public.prune_queue q
   WHERE q.user_id = auth.uid()
     AND q.reason IN ('legacy_no_consent','onboarding_no_consent')
     AND q.decision IN ('pending','approved','deferred')
     AND q.executed_at IS NULL
   LIMIT 1
$function$;
REVOKE EXECUTE ON FUNCTION public.get_my_deletion_notice() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_deletion_notice() TO authenticated;

-- Service: contas sem nenhum `granted` de health_data (legado + onboarding). Sem e-mail.
CREATE OR REPLACE FUNCTION public.prune_unconsented_accounts()
 RETURNS TABLE (user_id uuid, created_at timestamptz)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT u.id, u.created_at FROM auth.users u
     WHERE NOT EXISTS (
       SELECT 1 FROM public.consent_log c
        WHERE c.user_id = u.id AND c.consent_type = 'health_data' AND c.action = 'granted');
END; $function$;
REVOKE EXECUTE ON FUNCTION public.prune_unconsented_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_unconsented_accounts() TO service_role;

-- Service: e-mail das contas pedidas (máscara do list e reveal de 1 linha — S-3).
CREATE OR REPLACE FUNCTION public.prune_account_emails(p_user_ids uuid[])
 RETURNS TABLE (user_id uuid, email text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT u.id, u.email::text FROM auth.users u WHERE u.id = ANY (p_user_ids);
END; $function$;
REVOKE EXECUTE ON FUNCTION public.prune_account_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_account_emails(uuid[]) TO service_role;

-- ─── 5. Lápide do Marco Civil (FR-013) ──────────────────────────────────────────────────────
CREATE TABLE private.account_tombstone (
  user_id            uuid PRIMARY KEY,
  email              text NOT NULL,
  subject_hash       text NOT NULL,
  account_created_at timestamptz,
  deleted_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.account_tombstone ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.account_tombstone FROM PUBLIC, anon, authenticated, service_role;

-- Corpo = pg_get_functiondef de 2026-10-20 (S-9) + bloco `107` da lápide.
CREATE OR REPLACE FUNCTION public._delete_user_account_core(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text; v_policy_version text; v_created_at timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  SELECT u.email, u.created_at INTO v_email, v_created_at FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  -- 107 (FR-013, Marco Civil art. 15 + LGPD art. 16, I): vincula o access_log ao e-mail por 6 meses.
  -- Mesma transação: sem lápide, sem exclusão (INV-7). Purga em private.purge_access_log().
  INSERT INTO private.account_tombstone (user_id, email, subject_hash, account_created_at)
  VALUES (p_user_id, v_email, public.consent_subject_hash(v_email), v_created_at);

  -- 094: libera o DELETE efetivo em protocols/medicines (trigger de arquivamento). Local à
  -- transação; a guarda de papel no trigger impede que a pessoa reaproveite a flag.
  PERFORM set_config('dosiq.hard_delete', 'on', true);

  SELECT c.policy_version INTO v_policy_version FROM public.consent_log c
   WHERE c.user_id = p_user_id AND c.action IN ('granted','revoked')
   ORDER BY c.created_at DESC LIMIT 1;

  INSERT INTO public.consent_log (user_id, subject_hash, consent_type, action, policy_version, platform)
  VALUES (p_user_id, public.consent_subject_hash(v_email), 'health_data', 'account_deleted', v_policy_version, 'server');

  DELETE FROM public.stock_consumptions        WHERE user_id = p_user_id;
  DELETE FROM public.stock_adjustments         WHERE user_id = p_user_id;
  DELETE FROM public.medicine_logs             WHERE user_id = p_user_id;
  DELETE FROM public.stock                     WHERE user_id = p_user_id;
  DELETE FROM public.purchases                 WHERE user_id = p_user_id;
  DELETE FROM public.failed_notification_queue WHERE user_id = p_user_id;
  DELETE FROM public.notification_log          WHERE user_id = p_user_id;
  DELETE FROM public.notification_devices      WHERE user_id = p_user_id;
  DELETE FROM public.push_notification_logs    WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions        WHERE user_id = p_user_id;
  DELETE FROM public.bot_sessions              WHERE user_id = p_user_id;
  -- 090: etapas referenciam medicines (NO ACTION) — escada sai antes (etapas em CASCADE).
  DELETE FROM public.titrations                WHERE user_id = p_user_id;
  DELETE FROM public.protocols                 WHERE user_id = p_user_id;
  DELETE FROM public.treatment_plans           WHERE user_id = p_user_id;
  DELETE FROM public.medicines                 WHERE user_id = p_user_id;
  DELETE FROM public.gemini_reviews            WHERE user_id = p_user_id;
  DELETE FROM public.user_settings             WHERE user_id = p_user_id;

  DELETE FROM auth.users WHERE id = p_user_id;
END; $function$;

CREATE OR REPLACE FUNCTION private.purge_access_log()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM private.access_log WHERE hour_bucket < now() - interval '6 months';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- 107 (FR-013): a lápide vive o mesmo prazo do registro que ela torna atribuível.
  DELETE FROM private.account_tombstone WHERE deleted_at < now() - interval '6 months';

  DELETE FROM private.access_log_runs WHERE ran_at < now() - interval '6 months';
  INSERT INTO private.access_log_runs (job, rows) VALUES ('purge', v_count);

  RETURN v_count;
END;
$function$;
