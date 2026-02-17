import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { getCurrentTime, escapeMarkdownV2 } from '../../utils/formatters.js';

export async function handleHoje(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    let userId;
    try {
      userId = await getUserIdByChatId(chatId);
    } catch {
      return await bot.sendMessage(chatId, '⚠️ Você precisa vincular sua conta primeiro\\. Use /start para instruções\\.');
    }

    const { data: protocols, error } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(*)')
      .eq('user_id', userId)
      .eq('active', true);

    if (error) throw error;

    if (!protocols || protocols.length === 0) {
      return await bot.sendMessage(chatId, 'Você não possui protocolos ativos\\.');
    }

    // Get today's date in SP timezone
    const timezone = 'America/Sao_Paulo';
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now);

    // Fetch logs from last 24h to ensure we don't miss anything due to UTC shift
    // Then filter accurately in memory
    const { data: allLogs } = await supabase
      .from('medicine_logs')
      .select('protocol_id, taken_at')
      .eq('user_id', userId)
      .gte('taken_at', new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString());

    const todayLogs = allLogs?.filter(log => {
      const logDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(log.taken_at));
      return logDate === todayStr;
    }) || [];

    // Helper to convert HH:MM to minutes
    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Build schedule for today
    const schedule = [];
    protocols.forEach(protocol => {
      const protocolLogs = todayLogs.filter(l => l.protocol_id === protocol.id);
      
      protocol.time_schedule.forEach(time => {
        const scheduledMin = toMin(time);
        
        // Find if any log matches this slot (within 3h window)
        const wasTaken = protocolLogs.some(log => {
          const logTime = new Date(log.taken_at).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: timezone
          }).replace(/^24/, '00');
          
          const actualMin = toMin(logTime);
          return Math.abs(scheduledMin - actualMin) < 180; // 3 hour window
        });

        schedule.push({
          time,
          medicine: protocol.medicine.name,
          dosage: protocol.dosage_per_intake,
          taken: wasTaken
        });
      });
    });

    // Sort by time
    schedule.sort((a, b) => a.time.localeCompare(b.time));

    const currentTime = getCurrentTime();
    const todayFormatted = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    let message = `📅 *Doses de Hoje* \\(${escapeMarkdownV2(todayFormatted)}\\)\n\n`;

    schedule.forEach(item => {
      const status = item.taken ? '✅' : (item.time <= currentTime ? '⏰' : '⏱️');
      const medicineName = escapeMarkdownV2(item.medicine || 'Medicamento');
      const time = escapeMarkdownV2(item.time);
      const dosage = escapeMarkdownV2(String(item.dosage ?? 1));
      message += `${status} ${time} \\- ${medicineName} \\(${dosage}x\\)\n`;
    });

    const taken = schedule.filter(s => s.taken).length;
    const total = schedule.length;
    message += `\n📊 Progresso: ${taken}/${total} doses`;

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.error('Erro ao buscar agenda:', err);
    await bot.sendMessage(chatId, 'Erro ao buscar agenda de hoje\\.');
  }
}
