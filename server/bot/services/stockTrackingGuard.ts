import { supabase } from '../../services/supabase.js';

/**
 * Guard de modo dose-only para os comandos de estoque do bot (spec 044, T012).
 *
 * O usuário que desligou o controle de estoque não tem saldo para mostrar — e o bot NÃO pode
 * responder "estoque 0" / lista vazia (afirmação falsa sobre um dado que ele optou por não ter).
 * Responde CONVITE DE ATIVAÇÃO (copy §9 do doc de decisões da 044).
 *
 * Fail-safe (AP-277): erro de leitura ou linha ausente em user_settings → estoque ATIVO
 * (comportamento de hoje, FR-009). A ausência de dado nunca desliga o estoque por omissão.
 */

export const STOCK_DISABLED_INVITE =
  'Você ainda não acompanha o estoque por aqui, então não tenho saldo para te mostrar. ' +
  'Quer que eu avise quando um remédio estiver acabando? ' +
  'É só ativar o controle de estoque no app, em Configurações.';

export async function isStockTrackingEnabled(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('stock_tracking_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[stockTrackingGuard] erro ao ler a preferência de estoque:', error);
    return true;
  }
  return data?.stock_tracking_enabled !== false;
}

/**
 * Se o usuário está em dose-only, responde o convite e retorna `true` (o comando deve abortar).
 * Texto simples de propósito: sem parse_mode, sem MarkdownV2 para escapar.
 */
export async function replyIfStockDisabled(bot, chatId, userId) {
  const enabled = await isStockTrackingEnabled(userId);
  if (enabled) return false;
  await bot.sendMessage(chatId, STOCK_DISABLED_INVITE);
  return true;
}
