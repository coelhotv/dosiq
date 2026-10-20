-- 20261020_107b_unconfirmed_signup.sql — spec 107 FR-016
--
-- Cadastro nunca confirmado (e-mail sem confirmação há > 30 dias) entra direto na fila de exclusão
-- com motivo próprio, SEM onda 2 nem avisos: o endereço pode não existir, ou ser de outra pessoa
-- (digitado errado) — mandar "sua conta será excluída" a um desconhecido é pior que não mandar. A
-- conta não consegue entrar no app, logo não autorizou nem tem dados. Continua exigindo aprovação
-- do admin; o executor reconfere que segue sem confirmação.
--
-- Mudanças:
--   1. `prune_queue.reason` aceita 'unconfirmed_signup'.
--   2. `prune_unconsented_accounts()` e `prune_account_emails(uuid[])` devolvem `email_confirmed`
--      (mudança de tipo de retorno ⇒ DROP + CREATE; grants refeitos, service-only — S-3/AP-275).

BEGIN;

ALTER TABLE public.prune_queue DROP CONSTRAINT prune_queue_reason_check;
ALTER TABLE public.prune_queue ADD CONSTRAINT prune_queue_reason_check
  CHECK (reason IN ('revoked_90d','legacy_no_consent','onboarding_no_consent','unconfirmed_signup'));

DROP FUNCTION public.prune_unconsented_accounts();
CREATE FUNCTION public.prune_unconsented_accounts()
 RETURNS TABLE (user_id uuid, created_at timestamptz, email_confirmed boolean)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT u.id, u.created_at, (u.email_confirmed_at IS NOT NULL) FROM auth.users u
     WHERE NOT EXISTS (
       SELECT 1 FROM public.consent_log c
        WHERE c.user_id = u.id AND c.consent_type = 'health_data' AND c.action = 'granted');
END; $function$;
REVOKE EXECUTE ON FUNCTION public.prune_unconsented_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_unconsented_accounts() TO service_role;

DROP FUNCTION public.prune_account_emails(uuid[]);
CREATE FUNCTION public.prune_account_emails(p_user_ids uuid[])
 RETURNS TABLE (user_id uuid, email text, email_confirmed boolean)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT u.id, u.email::text, (u.email_confirmed_at IS NOT NULL) FROM auth.users u
     WHERE u.id = ANY (p_user_ids);
END; $function$;
REVOKE EXECUTE ON FUNCTION public.prune_account_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_account_emails(uuid[]) TO service_role;

COMMIT;
