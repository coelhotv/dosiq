import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { getCurrentTime, escapeMarkdownV2 } from '../../utils/formatters.js';

export async function handleProxima(bot, msg) {
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
      return await bot.sendMessage(chatId, 'Você não possui protocolos ativos\\.');
    }

    const currentTime = getCurrentTime();
    
    // Collect all upcoming doses
    const upcomingDoses = [];
    protocols.forEach(protocol => {
      (protocol.time_schedule as any[]).forEach(time => {
        if (time >= currentTime) {
          upcomingDoses.push({
            time,
            medicine: protocol.medicine.name,
            dosage: protocol.dosage_per_intake,
            notes: protocol.notes
          });
        }
      });
    });

    // Sort by time
    upcomingDoses.sort((a, b) => a.time.localeCompare(b.time));

    if (upcomingDoses.length === 0) {
      return await bot.sendMessage(chatId, 'Não há mais doses programadas para hoje\\.');
    }

    const next = upcomingDoses[0];
    const medicineName = escapeMarkdownV2(next.medicine || 'Medicamento');
    const dosage = escapeMarkdownV2(String(next.dosage ?? 1));
    const time = escapeMarkdownV2(next.time);
    
    let message = `⏰ *Próxima Dose:*\n\n`;
    message += `🕐 Horário: *${time}*\n`;
    message += `💊 Medicamento: *${medicineName}*\n`;
    message += `📏 Quantidade: ${dosage}x\n`;
    
    if (next.notes) {
      const notes = escapeMarkdownV2(next.notes);
      message += `📝 _${notes}_\n`;
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    if (err.message === 'User not linked') {
      return bot.sendMessage(chatId, '❌ Conta não vinculada\\. Use /start para vincular\\.');
    }
    console.error('Erro ao buscar próxima dose:', err);
    await bot.sendMessage(chatId, 'Erro ao buscar próxima dose\\.');
  }
}
