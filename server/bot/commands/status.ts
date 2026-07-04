import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { formatProtocol } from '../../utils/formatters.js';

export async function handleStatus(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    const userId = await getUserIdByChatId(chatId);

    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
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
