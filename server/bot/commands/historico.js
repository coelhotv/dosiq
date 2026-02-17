import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { escapeMarkdownV2 } from '../../utils/formatters.js';

export async function handleHistorico(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    const userId = await getUserIdByChatId(chatId);
    
    const { data: logs, error } = await supabase
      .from('medicine_logs')
      .select(`
        *,
        medicine:medicines(name),
        protocol:protocols(*)
      `)
      .eq('user_id', userId)
      .order('taken_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!logs || logs.length === 0) {
      return await bot.sendMessage(chatId, 'Nenhuma dose registrada ainda\\.');
    }

    let message = '📜 *Histórico Recente:*\n\n';

    logs.forEach(log => {
      const date = new Date(log.taken_at);
      const dateStr = date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      const timeStr = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      });
      const medicineName = escapeMarkdownV2(log.medicine?.name || 'Medicamento');
      const quantity = escapeMarkdownV2(String(log.quantity_taken ?? 0));
      
      message += `📅 ${dateStr} às ${timeStr}\n`;
      message += `💊 ${medicineName} \\- ${quantity}x\n\n`;
    });

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    if (err.message === 'User not linked') {
      return bot.sendMessage(chatId, '❌ Conta não vinculada\\. Use /start para vincular\\.');
    }
    console.error('Erro ao buscar histórico:', err);
    await bot.sendMessage(chatId, 'Erro ao buscar histórico\\.');
  }
}
