-- 20260715_delete_account_lift_block_on_revoke.sql — spec 046, Slice B (furo do smoke).
--
-- PROBLEMA (dead-end de eliminação sob revogação)
-- ─────────────────────────────────────────────────────────────────────────────
-- `delete_user_account()` bloqueia a exclusão quando há tratamentos ativos
-- (`active_treatments_block`). É regra de UX do titular ("você tem tratamento em
-- curso, tem certeza?") — a saída oferecida é ir pausar/finalizar os tratamentos.
--
-- Mas quando o consentimento foi REVOGADO, o app está TRAVADO na allowlist do 046:
-- a rota de tratamentos não existe (nem no navegador travado do mobile, nem na
-- sidebar da web). O titular que revogou e quer exercer o direito à eliminação
-- (LGPD art. 18, VI) fica em dead-end: o botão "Abrir tratamentos" navega para uma
-- rota inalcançável e não há como destravar a exclusão.
--
-- O direito à eliminação NÃO pode ser condicionado a um fluxo de produto que a
-- própria trava de consentimento tornou inacessível. A revogação já é a
-- manifestação inequívoca de que o titular quer sair.
--
-- FIX (server-authoritative)
-- ─────────────────────────────────────────────────────────────────────────────
-- O UX-block é levantado quando `user_settings.consent_revoked_at` está setado. A
-- decisão vive no servidor (lê a flag da própria trilha, não confia num parâmetro
-- do client). Fora da revogação, o block segue idêntico. `_delete_user_account_core`
-- e a assinatura pública permanecem inalterados (AP-227).

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid            uuid := auth.uid();
  active_count   integer;
  consent_gone   boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Consent revogado levanta o UX-block: sob a trava do 046, tratamentos é
  -- inalcançável, e a eliminação (art. 18, VI) não pode depender dele.
  SELECT consent_revoked_at IS NOT NULL INTO consent_gone
  FROM public.user_settings
  WHERE user_id = uid;

  IF NOT coalesce(consent_gone, false) THEN
    -- Regra de UX do titular — vive AQUI, e só aqui (S1). O botão in-app segue bloqueando.
    SELECT count(*) INTO active_count
    FROM public.protocols
    WHERE user_id = uid
      AND active = true
      AND (end_date IS NULL OR end_date >= current_date);

    IF active_count > 0 THEN
      RAISE EXCEPTION 'active_treatments_block'
        USING DETAIL = active_count::text;
    END IF;
  END IF;

  PERFORM public._delete_user_account_core(uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
