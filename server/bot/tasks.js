import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { 
  getActiveProtocols, 
  getUserSettings,
  getAllUsersWithTelegram 
} from '../services/protocolCache.js';
import { shouldSendNotification } from '../services/notificationDeduplicator.js';
import { 
  getCurrentTimeInTimezone, 
  getCurrentDateInTimezone, 
  formatTimeInTimezone 
} from '../utils/timezone.js';
import { calculateDaysRemaining } from '../utils/formatters.js';

const logger = createLogger('Tasks');

// --- Markdown Escaping Utility ---

/**
 * Escape special Markdown characters for Telegram
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

// --- Rich Message Formatting Functions ---

/**
 * Format a rich dose reminder message
 * @param {object} protocol - Protocol data
 * @param {string} scheduledTime - Scheduled time (HH:MM)
 * @returns {string} Formatted message
 */
function formatDoseReminderMessage(protocol, scheduledTime) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdown(medicine.name || 'Medicamento');
  const dosage = protocol.dosage_per_intake || 1;
  const unit = escapeMarkdown(medicine.dosage_unit || 'unidades');
  const notes = protocol.notes ? escapeMarkdown(protocol.notes) : null;

  let message = `💊 *Hora do seu remédio!*\n\n`;
  message += `🩹 **${name}**\n`;
  message += `📋 ${dosage} ${unit}\n`;
  message += `⏰ Horário: ${scheduledTime}\n`;

  // Add titration info if applicable
  if (protocol.titration_schedule && protocol.titration_schedule.length > 0) {
    const currentStage = protocol.current_stage_index || 0;
    const totalStages = protocol.titration_schedule.length;
    message += `🎯 Titulação: Etapa ${currentStage + 1}/${totalStages}\n`;
  }

  // Add notes only if they exist
  if (notes) {
    message += `\n📝 _${notes}_`;
  }

  return message;
}

/**
 * Format a rich soft reminder message
 * @param {object} protocol - Protocol data
 * @returns {string} Formatted message
 */
function formatSoftReminderMessage(protocol) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdown(medicine.name || 'Medicamento');
  const dosage = protocol.dosage_per_intake || 1;
  const unit = escapeMarkdown(medicine.dosage_unit || 'unidades');

  let message = `⏳ *Lembrete*\n\n`;
  message += `Você ainda não registrou sua dose de **${name}** (${dosage} ${unit}).\n\n`;
  message += `Caso já tenha tomado, registre agora:`;

  return message;
}

/**
 * Format stock alert message
 * @param {Array} zeroStock - Medicines with zero stock
 * @param {Array} lowStock - Medicines with low stock
 * @returns {string} Formatted message
 */
function formatStockAlertMessage(zeroStock, lowStock) {
  let message = '';

  if (zeroStock.length > 0) {
    message += '🚨 *ALERTA DE ESTOQUE ZERADO*\n\n';
    message += 'Os seguintes medicamentos estão sem estoque:\n\n';
    zeroStock.forEach(m => {
      message += `❌ **${escapeMarkdown(m.name)}**\n`;
    });
    message += '\n⚠️ Reponha o estoque o quanto antes!\n\n';
  }

  if (lowStock.length > 0) {
    message += '⚠️ *Alerta de Estoque Baixo*\n\n';
    message += 'Atenção aos seguintes medicamentos:\n\n';
    lowStock.forEach(m => {
      const days = m.days <= 0 ? 'estoque zerado' : `~${m.days} dia(s) restante(s)`;
      message += `📦 **${escapeMarkdown(m.name)}**\n   └ ${days}\n`;
    });
    message += '\n💡 Considere repor o estoque em breve.';
  }

  return message;
}

/**
 * Format titration alert message
 * @param {object} protocol - Protocol data
 * @returns {string} Formatted message
 */
function formatTitrationAlertMessage(protocol) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdown(medicine.name || 'Medicamento');
  const currentStage = protocol.current_stage_index || 0;
  const totalStages = protocol.titration_schedule?.length || 0;

  let message = `🎯 *Atualização de Titulação*\n\n`;
  message += `Medicamento: **${name}**\n`;
  message += `Etapa atual: ${currentStage + 1}/${totalStages}\n\n`;

  if (protocol.titration_status === 'alvo_atingido') {
    message += `✅ *Parabéns!* Você atingiu a dose alvo!\n`;
    message += `Continue com o acompanhamento médico.`;
  } else if (protocol.titration_status === 'titulando') {
    const nextStage = protocol.titration_schedule?.[currentStage + 1];
    if (nextStage) {
      message += `📈 Próxima etapa: ${nextStage.dosage} ${escapeMarkdown(medicine.dosage_unit || 'mg')}\n`;
      message += `⏰ Data prevista: ${nextStage.date || 'a definir'}`;
    }
  }

  return message;
}

// --- Helper Functions ---

async function sendDoseNotification(bot, chatId, p, scheduledTime) {
  const message = formatDoseReminderMessage(p, scheduledTime);

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Tomar', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
      ]
    ]
  };

  await bot.sendMessage(chatId, message, {
    parse_mode: 'MarkdownV2',
    reply_markup: keyboard
  });
}

/**
 * Check reminders for a specific user
 * @param {object} bot - Bot adapter
 * @param {string} userId - User UUID
 * @param {string} chatId - Telegram chat ID
 */
async function checkUserReminders(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) {
      logger.warn(`No settings found for user`, { userId });
      return;
    }

    const timezone = settings.timezone || 'America/Sao_Paulo';
    const currentHHMM = getCurrentTimeInTimezone(timezone);
    
    logger.debug(`Checking reminders`, { userId, time: currentHHMM, timezone });

    const protocols = await getActiveProtocols(userId, true);

    for (const p of protocols) {
      // --- 1. Main Notifications ---
      if (p.time_schedule.includes(currentHHMM)) {
        // Check if already taken
        const { data: recentLogs } = await supabase
          .from('medicine_logs')
          .select('taken_at')
          .eq('protocol_id', p.id)
          .gte('taken_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const todayYYYYMMDD = getCurrentDateInTimezone(timezone);
        
        const timeToMinutes = (time) => {
          const [h, m] = time.split(':').map(Number);
          return h * 60 + m;
        };

        let alreadyTaken = false;

        if (recentLogs && recentLogs.length > 0) {
          const todaysLogs = recentLogs.filter(l => {
            const logDateVal = new Date(l.taken_at);
            const logDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(logDateVal);
            return logDateStr === todayYYYYMMDD;
          });

          for (const log of todaysLogs) {
            const logHHMM = formatTimeInTimezone(log.taken_at, timezone);
            const logMinutes = timeToMinutes(logHHMM);
            
            let minDiff = Infinity;
            let closestSchedule = null;
            
            p.time_schedule.forEach(schedule => {
                const schedMinutes = timeToMinutes(schedule);
                const diff = Math.abs(logMinutes - schedMinutes);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestSchedule = schedule;
                }
            });
            
            if (closestSchedule === currentHHMM) {
              alreadyTaken = true;
              break;
            }
          }
        }

        if (alreadyTaken) {
          logger.debug(`Dose already taken`, { userId, medicine: p.medicine.name, time: currentHHMM });
          continue;
        }

        // Check deduplication
        const shouldSend = await shouldSendNotification(p.id, 'dose_reminder');
        if (!shouldSend) continue;

        await sendDoseNotification(bot, chatId, p, currentHHMM);
        logger.info(`Dose reminder sent`, { userId, medicine: p.medicine.name, time: currentHHMM });
        
        await supabase
          .from('protocols')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', p.id);
      }

      // --- 2. Soft Reminders (30 min later) ---
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();

      if (p.last_notified_at && p.last_notified_at <= thirtyMinsAgo && p.last_notified_at > thirtyFiveMinsAgo) {
        
        if (p.last_soft_reminder_at && p.last_soft_reminder_at > thirtyFiveMinsAgo) {
          continue;
        }

        const shouldSend = await shouldSendNotification(p.id, 'soft_reminder');
        if (!shouldSend) continue;

        const { data: logs } = await supabase
          .from('medicine_logs')
          .select('id')
          .eq('protocol_id', p.id)
          .gte('taken_at', p.last_notified_at);

        if (!logs || logs.length === 0) {
          logger.info(`Soft reminder sent`, { userId, medicine: p.medicine.name });
          
          const message = formatSoftReminderMessage(p);
          
          await bot.sendMessage(chatId, message,
            {
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Tomei', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
                  { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
                  { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
                ]]
              }
            }
          );

          await supabase
            .from('protocols')
            .update({ last_soft_reminder_at: new Date().toISOString() })
            .eq('id', p.id);
        }
      }
    }
  } catch (err) {
    logger.error(`Error checking reminders for user`, err, { userId });
  }
}

/**
 * Check reminders for ALL users (cron job)
 * @param {object} bot - Bot adapter
 */
export async function checkReminders(bot) {
  logger.info('Starting reminder check for all users');
  
  const users = await getAllUsersWithTelegram();
  
  if (users.length === 0) {
    logger.warn('No users with Telegram found');
    return;
  }

  logger.info(`Found ${users.length} users with Telegram`);

  for (const user of users) {
    await checkUserReminders(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Reminder check completed');
}

/**
 * Run daily digest for a specific user
 */
async function runUserDailyDigest(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) return;

    const timezone = settings.timezone || 'America/Sao_Paulo';
    const today = getCurrentDateInTimezone(timezone);
    
    // Check deduplication
    const shouldSend = await shouldSendNotification(userId, 'daily_digest');
    if (!shouldSend) return;

    const { data: logs } = await supabase
      .from('medicine_logs')
      .select('*, medicine:medicines(name)')
      .eq('user_id', userId)
      .gte('taken_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const todayLogs = logs?.filter(l => {
      const logDate = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date(l.taken_at));
      return logDate === today;
    }) || [];

    const protocols = await getActiveProtocols(userId, true);
    const expectedDoses = protocols.reduce((sum, p) => sum + (p.time_schedule?.length || 0), 0);
    const takenDoses = todayLogs.length;
    const percentage = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0;

    const dateStr = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format(new Date());

    let message = `📊 *Resumo do Dia*\n\n`;
    message += `📅 ${escapeMarkdown(dateStr)}\n\n`;
    message += `✅ Doses tomadas: ${takenDoses}/${expectedDoses}\n`;
    message += `📈 Taxa de adesão: ${percentage}%\n\n`;

    if (percentage === 100) {
      message += '🎉 *Parabéns! Você completou todas as doses hoje!*';
    } else if (percentage >= 80) {
      message += '👍 *Bom trabalho! Continue assim!*';
    } else if (percentage >= 50) {
      message += '⚠️ *Atenção! Tome as doses restantes.*';
    } else {
      message += '🚨 *Cuidado! Você está atrasado nas doses.*';
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    logger.info(`Daily digest sent`, { userId, percentage });

  } catch (err) {
    logger.error(`Error sending daily digest`, err, { userId });
  }
}

/**
 * Run daily digest for ALL users
 */
export async function runDailyDigest(bot) {
  logger.info('Starting daily digest for all users');
  
  const users = await getAllUsersWithTelegram();
  
  for (const user of users) {
    await runUserDailyDigest(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Daily digest completed');
}

/**
 * Check stock alerts for a specific user
 */
async function checkUserStockAlerts(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) return;

    const { data: medicines } = await supabase
      .from('medicines')
      .select(`
        *,
        stock(*),
        protocols!protocols_medicine_id_fkey(*)
      `)
      .eq('user_id', userId);

    if (!medicines || medicines.length === 0) return;

    const lowStockMedicines = [];
    const zeroStockMedicines = [];

    for (const medicine of medicines) {
      const activeProtocols = (medicine.protocols || []).filter(p => p.active);
      if (activeProtocols.length === 0) continue;

      const totalQuantity = (medicine.stock || []).reduce((sum, s) => sum + s.quantity, 0);
      const dailyUsage = activeProtocols.reduce((sum, p) => {
        const timesPerDay = p.time_schedule?.length || 0;
        const dosagePerIntake = p.dosage_per_intake || 0;
        return sum + (timesPerDay * dosagePerIntake);
      }, 0);

      const daysRemaining = calculateDaysRemaining(totalQuantity, dailyUsage);

      if (daysRemaining !== null && daysRemaining <= 0) {
        zeroStockMedicines.push({ name: medicine.name, days: daysRemaining });
      } else if (daysRemaining !== null && daysRemaining <= 7) {
        lowStockMedicines.push({ name: medicine.name, days: daysRemaining });
      }
    }

    if (lowStockMedicines.length === 0 && zeroStockMedicines.length === 0) return;

    // Check deduplication (only send once per day)
    const shouldSend = await shouldSendNotification(userId, 'stock_alert');
    if (!shouldSend) return;

    const message = formatStockAlertMessage(zeroStockMedicines, lowStockMedicines);

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    logger.info(`Stock alert sent`, { userId, low: lowStockMedicines.length, zero: zeroStockMedicines.length });

  } catch (err) {
    logger.error(`Error checking stock alerts`, err, { userId });
  }
}

/**
 * Check stock alerts for ALL users
 */
export async function checkStockAlerts(bot) {
  logger.info('Starting stock alerts for all users');
  
  const users = await getAllUsersWithTelegram();
  
  for (const user of users) {
    await checkUserStockAlerts(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Stock alerts completed');
}

/**
 * Check adherence reports for ALL users (weekly)
 * @param {object} bot - Bot adapter
 */
export async function checkAdherenceReports(bot) {
  logger.info('Starting adherence reports for all users');

  try {
    const users = await getAllUsersWithTelegram();

    for (const user of users) {
      try {
        await runUserWeeklyAdherenceReport(bot, user.user_id, user.telegram_chat_id);
      } catch (err) {
        logger.error(`Error sending adherence report to user`, err, { userId: user.user_id });
      }
    }

    logger.info('Adherence reports completed');
  } catch (err) {
    logger.error('Failed to run adherence reports', err);
    throw err;
  }
}

/**
 * Run weekly adherence report for a specific user
 * @param {object} bot - Bot adapter
 * @param {string} userId - User UUID
 * @param {string} chatId - Telegram chat ID
 */
async function runUserWeeklyAdherenceReport(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) return;

    // Timezone is available for future use (e.g., date formatting)
    // const timezone = settings.timezone || 'America/Sao_Paulo';
    
    // Check deduplication
    const shouldSend = await shouldSendNotification(userId, 'weekly_adherence');
    if (!shouldSend) return;

    // Calculate adherence for the past week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('taken_at', oneWeekAgo);

    const protocols = await getActiveProtocols(userId, true);
    const expectedDoses = protocols.reduce((sum, p) => {
      const daysActive = Math.min(7, p.time_schedule?.length ? 7 : 0);
      return sum + ((p.time_schedule?.length || 0) * daysActive);
    }, 0);
    
    const takenDoses = logs?.length || 0;
    const percentage = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0;

    let message = `📊 *Relatório Semanal de Adesão*\n\n`;
    message += `📈 Taxa de adesão: ${percentage}%\n`;
    message += `✅ Doses tomadas: ${takenDoses}\n`;
    message += `📋 Doses esperadas: ${expectedDoses}\n\n`;

    if (percentage >= 90) {
      message += '🎉 *Excelente!* Você está muito bem com seu tratamento!';
    } else if (percentage >= 70) {
      message += '👍 *Bom trabalho!* Continue se esforçando para melhorar.';
    } else {
      message += '⚠️ *Atenção!* Tente melhorar sua regularidade nas doses.';
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    logger.info(`Weekly adherence report sent`, { userId, percentage });

  } catch (err) {
    logger.error(`Error sending weekly adherence report`, err, { userId });
  }
}

/**
 * Check titration alerts for a specific user
 */
async function checkUserTitrationAlerts(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) return;

    // Get protocols that are in titration
    const { data: protocols } = await supabase
      .from('protocols')
      .select(`
        *,
        medicine:medicines(name, dosage_unit)
      `)
      .eq('user_id', userId)
      .in('titration_status', ['titulando', 'alvo_atingido']);

    if (!protocols || protocols.length === 0) return;

    for (const protocol of protocols) {
      // Check if we should send notification for this protocol
      const shouldSend = await shouldSendNotification(protocol.id, 'titration_alert');
      if (!shouldSend) continue;

      const message = formatTitrationAlertMessage(protocol);

      await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      logger.info(`Titration alert sent`, { userId, medicine: protocol.medicine?.name });
    }

  } catch (err) {
    logger.error(`Error checking titration alerts`, err, { userId });
  }
}

/**
 * Check titration alerts for ALL users
 */
export async function checkTitrationAlerts(bot) {
  logger.info('Starting titration alerts for all users');

  const users = await getAllUsersWithTelegram();

  for (const user of users) {
    await checkUserTitrationAlerts(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Titration alerts completed');
}

/**
 * Check monthly reports for ALL users
 * @param {object} bot - Bot adapter
 */
export async function checkMonthlyReport(bot) {
  logger.info('Starting monthly reports for all users');

  try {
    const users = await getAllUsersWithTelegram();

    for (const user of users) {
      try {
        await runUserMonthlyReport(bot, user.user_id, user.telegram_chat_id);
      } catch (err) {
        logger.error(`Error sending monthly report to user`, err, { userId: user.user_id });
      }
    }

    logger.info('Monthly reports completed');
  } catch (err) {
    logger.error('Failed to run monthly reports', err);
    throw err;
  }
}

/**
 * Run monthly report for a specific user
 * @param {object} bot - Bot adapter
 * @param {string} userId - User UUID
 * @param {string} chatId - Telegram chat ID
 */
async function runUserMonthlyReport(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) return;

    // Check deduplication
    const shouldSend = await shouldSendNotification(userId, 'monthly_report');
    if (!shouldSend) return;

    // Calculate adherence for the past month
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('taken_at', oneMonthAgo);

    const protocols = await getActiveProtocols(userId, true);
    const expectedDoses = protocols.reduce((sum, p) => {
      const daysActive = 30;
      return sum + ((p.time_schedule?.length || 0) * daysActive);
    }, 0);
    
    const takenDoses = logs?.length || 0;
    const percentage = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0;

    let message = `📊 *Relatório Mensal*\n\n`;
    message += `📈 Taxa de adesão: ${percentage}%\n`;
    message += `✅ Doses tomadas: ${takenDoses}\n`;
    message += `📋 Doses esperadas: ${expectedDoses}\n\n`;

    if (percentage >= 90) {
      message += '🏆 *Parabéns!* Mês excelente de tratamento!';
    } else if (percentage >= 70) {
      message += '👍 *Bom trabalho!* Você está no caminho certo.';
    } else {
      message += '💪 *Vamos melhorar!* O próximo mês será melhor.';
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    logger.info(`Monthly report sent`, { userId, percentage });

  } catch (err) {
    logger.error(`Error sending monthly report`, err, { userId });
  }
}