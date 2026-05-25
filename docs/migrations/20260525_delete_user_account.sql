-- 20260525_delete_user_account.sql — Fase 4 W3
-- RPC para exclusão de conta (Perfil → Configurações → Excluir minha conta).
--
-- Regras (CLAUDE.md · PO-10):
-- - SECURITY DEFINER + SET search_path = '' (anti search-path injection)
-- - REVOKE de PUBLIC e anon; GRANT só para authenticated
-- - public.<tabela> qualificado no corpo
-- - BLOQUEIA se houver tratamentos ativos (protocols.active = true e dentro do
--   período) — força o usuário a pausar/finalizar antes (defesa server-side;
--   o app também pré-checa e mostra o estado bloqueado no sheet)
-- - Deleta na ordem de dependência (filhos → pais) e por fim auth.users
--
-- Aplicar via Supabase MCP (apply_migration). Agente autorizado pelo PO.

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  active_count integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Bloqueio: tratamentos ativos impedem exclusão (PO-10).
  SELECT count(*) INTO active_count
  FROM public.protocols
  WHERE user_id = uid
    AND active = true
    AND (end_date IS NULL OR end_date >= current_date);

  IF active_count > 0 THEN
    RAISE EXCEPTION 'active_treatments_block'
      USING DETAIL = active_count::text;
  END IF;

  -- Filhos → pais (sem ON DELETE CASCADE nas FKs do schema).
  DELETE FROM public.stock_consumptions       WHERE user_id = uid;
  DELETE FROM public.stock_adjustments        WHERE user_id = uid;
  DELETE FROM public.medicine_logs            WHERE user_id = uid;
  DELETE FROM public.stock                    WHERE user_id = uid;
  DELETE FROM public.purchases                WHERE user_id = uid;
  DELETE FROM public.failed_notification_queue WHERE user_id = uid;
  DELETE FROM public.notification_log         WHERE user_id = uid;
  DELETE FROM public.notification_devices     WHERE user_id = uid;
  DELETE FROM public.push_notification_logs   WHERE user_id = uid;
  DELETE FROM public.push_subscriptions       WHERE user_id = uid;
  DELETE FROM public.bot_sessions             WHERE user_id = uid;
  DELETE FROM public.protocols                WHERE user_id = uid;
  DELETE FROM public.treatment_plans          WHERE user_id = uid;
  DELETE FROM public.medicines                WHERE user_id = uid;
  DELETE FROM public.gemini_reviews           WHERE user_id = uid;
  DELETE FROM public.user_settings            WHERE user_id = uid;

  -- Por fim, a própria conta de autenticação.
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Verificação:
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'delete_user_account';
