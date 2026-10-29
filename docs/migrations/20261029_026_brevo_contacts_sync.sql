-- Spec 026 Slice 2A — boas-vindas via lista de contatos da Brevo (ADR-118, FR-2A-02..06).
--
-- O job `brevo_contacts_sync` (api/_ops/brevoContactsSync.ts) lê e marca só por estas RPCs:
--   brevo_sync_candidates  — contas novas a incluir (e-mail confirmado há ≥ 1 h, criadas a partir do start)
--   brevo_mark_synced      — marca local após 2xx da Brevo (1 marcou · 0 já marcada · -1 sem user_settings)
--   brevo_deleted_since    — exclusões pela lápide (só user_id — RC-SEC S-2)
-- As 3: SECURITY DEFINER, search_path vazio, só service_role (S-1: default ACL dá EXECUTE a anon).
-- `brevo_synced_at` é do controlador: o titular não grava (S-3, mesmo guard da 096).

-- ─── 1. Coluna + guard controller-owned ─────────────────────────────────────────────────────
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS brevo_synced_at timestamptz NULL;

COMMENT ON COLUMN public.user_settings.brevo_synced_at IS
  'Spec 026 2A: conta incluída na lista "New users" da Brevo. Só brevo_mark_synced grava — trg_user_settings_brevo_synced bloqueia o titular.';

-- Guard INVOKER (AP-292): `current_user` é a role do cliente via PostgREST e o owner dentro da RPC.
CREATE OR REPLACE FUNCTION public.guard_brevo_synced_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND (
       (TG_OP = 'INSERT' AND NEW.brevo_synced_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.brevo_synced_at IS DISTINCT FROM OLD.brevo_synced_at)) THEN
    RAISE EXCEPTION 'brevo_synced_at_is_controller_owned';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_brevo_synced_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_brevo_synced_at() FROM anon;

DROP TRIGGER IF EXISTS trg_user_settings_brevo_synced ON public.user_settings;
CREATE TRIGGER trg_user_settings_brevo_synced
  BEFORE INSERT OR UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_brevo_synced_at();

-- ─── 2. Candidatas (FR-2A-02, F-2: exige user_settings) ─────────────────────────────────────
-- p_since NULL ⇒ nada (INV-2A-4: nunca "todas"). p_limit fora de 1..200 ⇒ grampeado.
CREATE OR REPLACE FUNCTION public.brevo_sync_candidates(p_since timestamptz, p_limit int)
 RETURNS TABLE (user_id uuid, email text, created_at timestamptz, has_app boolean)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_since IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, u.created_at,
           (EXISTS (SELECT 1 FROM public.device_activity d WHERE d.user_id = u.id)
            OR EXISTS (SELECT 1 FROM public.notification_devices n WHERE n.user_id = u.id))
      FROM auth.users u
      JOIN public.user_settings s ON s.user_id = u.id
     WHERE u.email IS NOT NULL
       AND u.email_confirmed_at IS NOT NULL
       AND u.email_confirmed_at <= now() - interval '1 hour'
       AND u.created_at >= p_since
       AND s.brevo_synced_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.prune_queue q
          WHERE q.user_id = u.id
            AND q.decision IN ('pending', 'approved', 'deferred')
            AND q.executed_at IS NULL)
     ORDER BY u.created_at
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END; $function$;
REVOKE EXECUTE ON FUNCTION public.brevo_sync_candidates(timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brevo_sync_candidates(timestamptz, int) TO service_role;

-- ─── 3. Marca (FR-2A-05, C-2A-1) ────────────────────────────────────────────────────────────
-- 1 = marcou · 0 = já marcada (rodada concorrente, benigno) · -1 = sem linha em user_settings.
CREATE OR REPLACE FUNCTION public.brevo_mark_synced(p_user_id uuid)
 RETURNS int
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_n int;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.user_settings SET brevo_synced_at = now()
   WHERE user_id = p_user_id AND brevo_synced_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN RETURN 1; END IF;
  IF EXISTS (SELECT 1 FROM public.user_settings WHERE user_id = p_user_id) THEN RETURN 0; END IF;
  RETURN -1;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.brevo_mark_synced(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brevo_mark_synced(uuid) TO service_role;

-- ─── 4. Exclusões pela lápide (FR-2A-06, S-2: sem e-mail) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.brevo_deleted_since(p_since timestamptz)
 RETURNS TABLE (user_id uuid)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_since IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT t.user_id FROM private.account_tombstone t
     WHERE t.deleted_at >= p_since
     ORDER BY t.deleted_at;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.brevo_deleted_since(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brevo_deleted_since(timestamptz) TO service_role;
