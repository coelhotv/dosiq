import { supabase } from '../../services/supabase.js';
import { getUserIdByChatId } from '../../services/userService.js';
import { escapeMarkdownV2 } from '../../utils/formatters.js';
import {
  parseLocalDate,
  parseISO,
  addDays,
  getCurrentTimeInTimezone
} from '../../utils/dateUtils.js';
import {
  isProtocolActiveOnDate,
  getTodayLocal as getTodayLocalInTz,
  getUserTime,
  formatLocalDate
} from '@dosiq/core';

const DEFAULT_TZ = 'America/Sao_Paulo';

// 088 (Q-3): fuso da usuária, fallback SP. Erro de leitura degrada para SP — o /hoje responde mesmo assim.
async function _fetchUserTimezone(userId) {
  const { data } = await supabase
    .from('user_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.timezone || DEFAULT_TZ;
}

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

    // 088 (FR-008, E-1): UM "hoje" no fuso da usuária — decide o schedule E filtra os logs tomados.
    const timezone = await _fetchUserTimezone(userId);
    const todayStr = getTodayLocalInTz(timezone);
    const startOfDay = parseLocalDate(todayStr);

    // Fetch logs from last 36h to ensure we don't miss anything due to UTC shift
    const { data: allLogs } = await supabase
      .from('medicine_logs')
      .select('protocol_id, taken_at')
      .eq('user_id', userId)
      .gte('taken_at', addDays(startOfDay, -1).toISOString());

    // Hora de parede do log no fuso da usuária (getters locais sobre getUserTime — AP-342).
    const toUserWallClock = (iso) => getUserTime(parseISO(iso), timezone);
    const todayLogs = allLogs?.filter(log => {
      return formatLocalDate(toUserWallClock(log.taken_at)) === todayStr;
    }) || [];

    // Helper to convert HH:MM to minutes
    const toMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Build schedule for today
    const schedule = [];

    protocols.forEach(protocol => {
      // 088 (FR-001/003): motor único do core; confere período (US-1) e deriva o dia da semana da data.
      if (!isProtocolActiveOnDate(protocol, todayStr)) return;

      const protocolLogs = todayLogs.filter(l => l.protocol_id === protocol.id);
      
      (protocol.time_schedule as any[] || []).forEach(time => {
        const scheduledMin = toMin(time);
        
        // Find if any log matches this slot (within 3h window)
        const wasTaken = protocolLogs.some(log => {
          const logDate = toUserWallClock(log.taken_at);
          const logTime = logDate.getHours().toString().padStart(2, '0') + ':' + 
                          logDate.getMinutes().toString().padStart(2, '0');
          
          const actualMin = toMin(logTime);
          return Math.abs(scheduledMin - actualMin) < 180; // 3 hour window
        });

        schedule.push({
          time,
          medicine: protocol.medicine?.name || protocol.name,
          dosage: protocol.dosage_per_intake,
          taken: wasTaken
        });
      });
    });

    // Sort by time
    schedule.sort((a, b) => a.time.localeCompare(b.time));

    const currentTime = getCurrentTimeInTimezone(timezone);
    // Exibição amigável: DD/MM/YYYY
    const todayFormatted = todayStr.split('-').reverse().join('/');
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
