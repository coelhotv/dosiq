import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { formatProtocol } from '../../utils/formatters.js';

export async function handleStatus(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    const userId = await getUserIdByChatId(chatId);

    // 029 F6 (R-267 read-path): o embed da escada é OBRIGATÓRIO aqui. O `formatProtocol`
    // passou a derivar a linha de titulação de `titration_steps`; sem o embed ela seria
    // `undefined` e a linha sumiria em silêncio — trocar a coluna N1 pela N2 sem tocar no
    // select "consertaria" o 42703 e manteria a perda de informação que o repontamento
    // existe para evitar.
    // R-295: colunas conferidas no banco 2026-07-21; select executado contra o PostgREST.
    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*), titration_steps(id, position, dose, duration_days, status, started_at)')
      .eq('user_id', userId)
      .eq('active', true);

    if (error) throw error;

    if (!protocols || protocols.length === 0) {
      return await bot.sendMessage(chatId, 'Você não possui protocolos ativos no momento\\.');
    }
    
    // Fallback removed


    let message = '📋 *Seus Protocolos Ativos:*\n\n';
    protocols.forEach(p => {
      message += formatProtocol(p) + '\n';
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.error('Erro ao buscar protocolos:', err);
    await bot.sendMessage(chatId, 'Erro ao buscar seus dados\\.');
  }
}
