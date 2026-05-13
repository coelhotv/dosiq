-- Migration: 20260513_revoke_anon_security_definer
-- Revoga acesso do role `anon` em funções SECURITY DEFINER que não devem
-- ser executáveis por usuários não autenticados.
-- Contexto: Supabase Security Advisor alertou sobre SECURITY DEFINER functions
-- acessíveis via anon role. Todas as funções abaixo só devem ser chamadas
-- por usuários autenticados.

-- Funções de estoque (crítico — manipulam dados financeiros)
REVOKE EXECUTE ON FUNCTION public.apply_manual_stock_adjustment(uuid, numeric, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_purchase_with_stock(uuid, numeric, numeric, date, date, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(uuid, numeric, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.consume_stock_fifo(uuid, uuid, numeric, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.restore_stock_for_log(uuid, text) FROM anon;

-- Funções de reviews / Gemini integration
-- Handlers usam .from('gemini_reviews') diretamente; RPC não é chamado no fluxo ativo.
REVOKE EXECUTE ON FUNCTION public.batch_update_review_status(uuid[], text, text) FROM anon;

-- Telegram token — mobile só chama em sessão autenticada
REVOKE EXECUTE ON FUNCTION public.generate_telegram_token() FROM anon;

-- Migração de dados piloto — função de uso único, não deve ser pública
REVOKE EXECUTE ON FUNCTION public.migrate_pilot_data() FROM anon;

-- Push notification device registration — mobile sempre autenticado ao chamar
REVOKE EXECUTE ON FUNCTION public.upsert_notification_device(text, text, text, text, text, text, text) FROM anon;
