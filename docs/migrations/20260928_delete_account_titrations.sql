-- 20260928_delete_account_titrations.sql — spec 090 (achado no dry-run da PO-SEC-2) · LGPD art. 16
-- Conta com titulação volta a poder ser excluída.
--
-- PROBLEMA (provado em prod 2026-09-28, dry-run com ROLLBACK, SEM nenhuma migração da 090):
--   `_delete_user_account_core` apaga protocols e medicines, mas nunca titrations. As etapas
--   referenciam medicines por `titration_steps_medicine_id_fkey` (NO ACTION) ⇒ o DELETE de medicines
--   falha com 23503 e a exclusão INTEIRA volta. Toda conta com titulação (6 em prod) não consegue
--   excluir a conta — nem pelo app, nem pelo site.
--
-- FIX: apagar `titrations` da conta ANTES de protocols/medicines (etapas caem pela FK composta
--   (titration_id, user_id) CASCADE). Resto do corpo idêntico ao vigente (pg_get_functiondef 28/09).
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- R-270 CHANGE PREFLIGHT — Failure Modes & Degenerate Inputs
-- ─────────────────────────────────────────────────────────────────────────────
-- | Modo                                   | Análise / mitigação                                     |
-- |----------------------------------------|---------------------------------------------------------|
-- | Conta sem titulação                    | DELETE sem linhas — no-op.                              |
-- | Escada multi-protocolo / etapa NULL    | Apagada por user_id, independe do vínculo.              |
-- | Etapa de outra conta                   | FK composta (titration_id, user_id) impede; filtro por user_id. |
-- | Trigger trg_protocols_delete_titrations| Roda depois, sem escadas restantes — no-op.            |
-- | Histórico (R-299)                      | Nada referencia titration_steps. Conta sendo excluída.  |
-- | Assinatura/grants                      | CREATE OR REPLACE mesma assinatura (uuid) → grants preservados. |
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Reversível (recriar sem a linha). Aplicado via Supabase MCP após dry-run BEGIN..ROLLBACK.

CREATE OR REPLACE FUNCTION public._delete_user_account_core(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text; v_policy_version text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id_required'; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

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
