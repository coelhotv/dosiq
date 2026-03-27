import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { enqueue, ErrorCategories } from '../services/deadLetterQueue.js';
import { getCurrentCorrelationId, getOrGenerateCorrelationId } from './correlationLogger.js';
import {
  getActiveProtocols,
  getUserSettings,
  getAllUsersWithTelegram
} from '../services/protocolCache.js';
import { shouldSendNotification, logSuccessfulNotification } from '../services/notificationDeduplicator.js';
import {
  getCurrentTimeInTimezone,
  getCurrentDateInTimezone,
  formatTimeInTimezone
} from '../utils/timezone.js';
import { calculateDaysRemaining, escapeMarkdownV2 } from '../utils/formatters.js';

const logger = createLogger('Tasks');

// --- Helper Functions ---

/**
 * Wrap bot.sendMessage result with correlation metadata
 * @param {object} result - Result from bot.sendMessage
 * @param {string} correlationId - Correlation ID for tracking
 * @returns {object} Wrapped result with metadata
 */
function wrapSendMessageResult(result, correlationId) {
  return {
    ...result,
    correlationId,
    attempts: 1,
    retried: false
  };
}

/**
 * Função genérica para enviar alertas de estoque
 * Consolida lógica compartilhada: deduplicação, envio, logging e enfileiramento em DLQ
 *
 * @param {object} params - Parâmetros da função
 * @param {string} params.userId - ID do usuário
 * @param {string} params.chatId - ID do chat Telegram
 * @param {string} params.notificationType - Tipo de notificação ('stock_alert', 'proactive_stock_alert')
 * @param {function} params.formatMessage - Função que retorna a mensagem formatada
 * @param {object} params.bot - Instância do bot Telegram
 * @param {object} params.dlqPayload - Dados para enfileiramento em DLQ em caso de erro
 * @param {object} params.logContext - Contexto adicional para logging
 */
async function sendStockNotificationAlert({
  userId,
  chatId,
  notificationType,
  formatMessage,
  bot,
  dlqPayload,
  logContext = {}
}) {
  // Verificar deduplicação
  const shouldSend = await shouldSendNotification(userId, null, notificationType);
  if (!shouldSend) {
    logger.debug(`Notificação de estoque suprimida por deduplicação`, { userId, notificationType });
    return;
  }

  // Formatar e enviar mensagem
  const message = formatMessage();
  const result = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });

  if (result.success) {
    logger.info(`Alerta de estoque enviado com sucesso`, {
      userId,
      notificationType,
      chatId,
      messageId: result.messageId,
      ...logContext
    });
    await logSuccessfulNotification(userId, null, notificationType, { messageId: result.messageId });
  } else {
    logger.error(`Falha ao enviar alerta de estoque`, {
      userId,
      notificationType,
      chatId,
      error: result.error,
      ...logContext
    });

    // Enfileirar para retry via DLQ
    const correlationId = result.correlationId || getOrGenerateCorrelationId();
    await enqueue(
      {
        userId,
        protocolId: null,
        type: notificationType,
        chatId,
        payload: dlqPayload
      },
      result.error,
      result.attempts || 1,
      correlationId
    );
  }
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
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  const dosage = escapeMarkdownV2(String(protocol.dosage_per_intake ?? 1));
  const unit = escapeMarkdownV2(medicine.dosage_unit || 'unidades');
  const notes = protocol.notes ? escapeMarkdownV2(protocol.notes) : null;

  let message = `💊 *Hora do seu remédio\\!*\n\n`;
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
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  const dosage = escapeMarkdownV2(String(protocol.dosage_per_intake ?? 1));
  const unit = escapeMarkdownV2(medicine.dosage_unit || 'unidades');

  let message = `⏳ *Lembrete*\n\n`;
  message += `Você ainda não registrou sua dose de **${name}** \\(${dosage} ${unit}\\)\\.\n\n`;
  message += `Caso já tenha tomado, registre agora:`;

  return message;
}

/**
 * Calcula consumo diario real baseado em logs de doses (ultimos 30 dias).
 * Duplica logica do refillPredictionService para uso server-side (Option A da spec INT-02).
 *
 * @param {string} medicineId
 * @param {Array} allLogs - Logs de doses do usuario (ultimos 30 dias)
 * @param {number} fallbackDailyUsage - Consumo teorico (fallback)
 * @returns {{ dailyConsumption: number, isRealData: boolean }}
 */
function calcBotRealDailyConsumption(medicineId, allLogs, fallbackDailyUsage) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const recentLogs = allLogs.filter(
    l => l.medicine_id === medicineId && new Date(l.taken_at) >= thirtyDaysAgo
  );

  const uniqueDays = new Set(
    recentLogs.map(l => new Date(l.taken_at).toISOString().slice(0, 10))
  );

  if (uniqueDays.size >= 14) {
    const totalConsumed = recentLogs.reduce((sum, l) => sum + (l.quantity_taken ?? 0), 0);
    return { dailyConsumption: totalConsumed / uniqueDays.size, isRealData: true };
  }

  return { dailyConsumption: fallbackDailyUsage, isRealData: false };
}

/**
 * Formata data de stockout prevista como "DD/MM" para exibicao no bot.
 * @param {number} daysRemaining
 * @returns {string} Data no formato "DD/MM"
 */
function formatStockoutDate(daysRemaining) {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, Math.round(daysRemaining)));
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * Format stock alert message
 * @param {Array} zeroStock - Medicines with zero stock
 * @param {Array} lowStock - Medicines with low stock (cada item pode ter predictedStockoutDate)
 * @returns {string} Formatted message
 */
function formatStockAlertMessage(zeroStock, lowStock) {
  let message = '';

  if (zeroStock.length > 0) {
    message += '🚨 *ALERTA DE ESTOQUE ZERADO*\n\n';
    message += 'Os seguintes medicamentos estão sem estoque:\n\n';
    zeroStock.forEach(m => {
      message += `❌ **${escapeMarkdownV2(m.name)}**\n`;
    });
    message += '\n⚠️ Reponha o estoque o quanto antes\\!\n\n';
  }

  if (lowStock.length > 0) {
    message += '⚠️ *Alerta de Estoque Baixo*\n\n';
    message += 'Atenção aos seguintes medicamentos:\n\n';
    lowStock.forEach(m => {
      const days = m.days <= 0 ? 'estoque zerado' : escapeMarkdownV2(`~${m.days} dia(s) restante(s)`);
      const dateHint = m.predictedStockoutDate
        ? ` ${escapeMarkdownV2(`(previsto: ${m.predictedStockoutDate})`)}`
        : '';
      message += `📦 **${escapeMarkdownV2(m.name)}**\n   └ ${days}${dateHint}\n`;
    });
    message += '\n💡 Considere repor o estoque em breve\\.';
  }

  return message;
}

/**
 * Format proactive stock reminder message (8-14 days remaining)
 * @param {string} userName - User's first name
 * @param {Array} medicines - Medicines with proactive stock status (cada item pode ter predictedStockoutDate)
 * @returns {string} Formatted message
 */
function formatProactiveStockMessage(userName, medicines) {
  let message = `💡 *Lembrete de Reposição*\n\n`;
  message += `Oi ${escapeMarkdownV2(userName)}\\! Passando para lembrar que alguns medicamentos estão chegando no fim:\n\n`;

  medicines.forEach(m => {
    const dateHint = m.predictedStockoutDate
      ? ` ${escapeMarkdownV2(`(previsto: ${m.predictedStockoutDate})`)}`
      : '';
    message += `• ${escapeMarkdownV2(m.name)} — cerca de ${m.days} dias restantes${dateHint}\n`;
  });

  message += `\nQue tal aproveitar para fazer a reposição com calma\\? 🛒`;

  return message;
}

/**
 * Format titration alert message
 * @param {object} protocol - Protocol data
 * @returns {string} Formatted message
 */
function formatTitrationAlertMessage(protocol) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  const currentStage = protocol.current_stage_index || 0;
  const totalStages = protocol.titration_schedule?.length || 0;

  let message = `🎯 *Atualização de Titulação*\n\n`;
  message += `Medicamento: **${name}**\n`;
  message += `Etapa atual: ${currentStage + 1}/${totalStages}\n\n`;

  if (protocol.titration_status === 'alvo_atingido') {
    message += `✅ *Parabéns\\!* Você atingiu a dose alvo\\!\n`;
    message += `Continue com o acompanhamento médico\\.`;
  } else if (protocol.titration_status === 'titulando') {
    const nextStage = protocol.titration_schedule?.[currentStage + 1];
    if (nextStage) {
      message += `📈 Próxima etapa: ${nextStage.dosage} ${escapeMarkdownV2(medicine.dosage_unit || 'mg')}\n`;
      message += `⏰ Data prevista: ${nextStage.date || 'a definir'}`;
    }
  }

  return message;
}

// --- Helper Functions ---

/**
 * Envia notificação de dose e retorna resultado
 * @param {object} bot - Bot adapter
 * @param {string} chatId - ID do chat Telegram
 * @param {object} p - Protocolo
 * @param {string} scheduledTime - Horário agendado (HH:MM)
 * @returns {Promise<NotificationResult>} Resultado da operação
 */
async function sendDoseNotification(bot, chatId, p, scheduledTime) {
  const message = formatDoseReminderMessage(p, scheduledTime);
  const correlationId = getOrGenerateCorrelationId();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Tomar', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
        { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
        { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
      ]
    ]
  };

  // Direct send - bot adapter already handles errors and returns result object
  // Wrap result with correlation metadata
  return wrapSendMessageResult(
    await bot.sendMessage(chatId, message, {
      parse_mode: 'MarkdownV2',
      reply_markup: keyboard
    }),
    correlationId
  );
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

    logger.debug(`Protocolos encontrados para usuário`, {
      userId,
      timezone,
      currentTime: currentHHMM,
      protocolCount: protocols?.length || 0,
      protocols: protocols?.map(p => ({
        id: p.id,
        name: p.medicine?.name,
        active: p.active,
        timeSchedule: p.time_schedule,
        lastNotified: p.last_notified_at
      }))
    });

    for (const p of protocols) {
      // --- 1. Main Notifications ---
      const isScheduledNow = p.time_schedule?.includes(currentHHMM);
      
      logger.debug(`Verificando protocolo`, {
        userId,
        protocolId: p.id,
        medicineName: p.medicine?.name,
        currentHHMM,
        timeSchedule: p.time_schedule,
        isScheduledNow,
        lastNotified: p.last_notified_at
      });

      if (!isScheduledNow) {
        logger.debug(`Protocolo não está agendado para este horário`, {
          userId,
          protocolId: p.id,
          currentHHMM,
          timeSchedule: p.time_schedule
        });
        continue;
      }

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
        const shouldSend = await shouldSendNotification(userId, p.id, 'dose_reminder');
        if (!shouldSend) {
          logger.debug(`Dose reminder suppressed by deduplication`, {
            userId,
            medicine: p.medicine?.name,
            time: currentHHMM,
            protocolId: p.id
          });
          continue;
        }

        const notificationResult = await sendDoseNotification(bot, chatId, p, currentHHMM);

        if (!notificationResult.success) {
          logger.error(`Falha ao enviar lembrete de dose`, {
            userId,
            medicine: p.medicine?.name,
            time: currentHHMM,
            protocolId: p.id,
            chatId,
            error: notificationResult.error,
            attempts: notificationResult.attempts
          });
          
          // P1: Enviar para DLQ após todas as tentativas falharem
          const correlationId = notificationResult.correlationId || getCurrentCorrelationId();
          await enqueue(
            {
              userId,
              protocolId: p.id,
              type: 'dose_reminder',
              chatId,
              payload: { scheduledTime: currentHHMM, medicineName: p.medicine?.name }
            },
            notificationResult.error,
            notificationResult.attempts,
            correlationId
          );
          
          // Não atualiza last_notified_at em caso de falha
          continue;
        }

        // P1: O resultado real está em notificationResult.result
        const messageId = notificationResult.result?.messageId;
        
        logger.info(`Lembrete de dose enviado com sucesso`, {
          userId,
          medicine: p.medicine?.name,
          time: currentHHMM,
          protocolId: p.id,
          chatId,
          messageId,
          attempts: notificationResult.attempts,
          retried: notificationResult.retried
        });

        const logged = await logSuccessfulNotification(userId, p.id, 'dose_reminder', {
          messageId
        });

        if (logged) {
          await supabase
            .from('protocols')
            .update({
              last_notified_at: new Date().toISOString(),
              status_ultima_notificacao: 'enviada'
            })
            .eq('id', p.id);
        } else {
          logger.error('Falha ao registrar log de notificação. O protocolo não será atualizado para evitar inconsistência.', {
            userId,
            protocolId: p.id,
            messageId
          });
        }

      // --- 2. Soft Reminders (30 min later) ---
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();

      logger.debug(`Verificando soft reminder`, {
        userId,
        protocolId: p.id,
        medicineName: p.medicine?.name,
        currentHHMM,
        lastNotifiedAt: p.last_notified_at,
        lastSoftReminderAt: p.last_soft_reminder_at,
        thirtyMinsAgo,
        thirtyFiveMinsAgo,
        shouldCheckSoft: !!(p.last_notified_at && p.last_notified_at <= thirtyMinsAgo && p.last_notified_at > thirtyFiveMinsAgo)
      });

      if (p.last_notified_at && p.last_notified_at <= thirtyMinsAgo && p.last_notified_at > thirtyFiveMinsAgo) {
        
        if (p.last_soft_reminder_at && p.last_soft_reminder_at > thirtyFiveMinsAgo) {
          logger.debug(`Soft reminder já enviadorecentemente`, {
            userId,
            protocolId: p.id,
            lastSoftReminderAt: p.last_soft_reminder_at
          });
          continue;
        }

        const shouldSend = await shouldSendNotification(userId, p.id, 'soft_reminder');
        if (!shouldSend) {
          logger.debug(`Soft reminder suppressed by deduplication`, {
            userId,
            medicine: p.medicine?.name,
            protocolId: p.id
          });
          continue;
        }

        const { data: logs } = await supabase
          .from('medicine_logs')
          .select('id')
          .eq('protocol_id', p.id)
          .gte('taken_at', p.last_notified_at);

        if (!logs || logs.length === 0) {
          const message = formatSoftReminderMessage(p);
          const correlationId = getOrGenerateCorrelationId();
          
          // Direct send - bot adapter already handles errors and returns result object
          // Wrap result with correlation metadata
          const notificationResult = wrapSendMessageResult(
            await bot.sendMessage(chatId, message, {
              parse_mode: 'MarkdownV2',
              reply_markup: {
                inline_keyboard: [[
                  { text: '✅ Tomei', callback_data: `take_:${p.id}:${p.dosage_per_intake}` },
                  { text: '⏰ Adiar', callback_data: `snooze_:${p.id}` },
                  { text: '⏭️ Pular', callback_data: `skip_:${p.id}` }
                ]]
              }
            }),
            correlationId
          );
          
          if (!notificationResult.success) {
            logger.error(`Falha ao enviar soft reminder`, {
              userId,
              medicine: p.medicine?.name,
              protocolId: p.id,
              chatId,
              error: notificationResult.error,
              attempts: notificationResult.attempts
            });
            
            // Enviar para DLQ
            await enqueue(
              {
                userId,
                protocolId: p.id,
                type: 'soft_reminder',
                chatId,
                payload: { medicineName: p.medicine?.name }
              },
              notificationResult.error,
              notificationResult.attempts,
              correlationId
            );
            continue;
          }
          
          const messageId = notificationResult.result?.messageId;
          
          logger.info(`Soft reminder enviado com sucesso`, {
            userId,
            medicine: p.medicine?.name,
            protocolId: p.id,
            chatId,
            messageId,
            attempts: notificationResult.attempts,
            retried: notificationResult.retried
          });

          const logged = await logSuccessfulNotification(userId, p.id, 'soft_reminder', {
            messageId
          });

          if (logged) {
            await supabase
              .from('protocols')
              .update({ last_soft_reminder_at: new Date().toISOString() })
              .eq('id', p.id);
          } else {
            logger.warn('Falha ao registrar log de soft reminder.', {
              userId,
              protocolId: p.id,
              messageId
            });
          }
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
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkReminders(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  const users = await getAllUsersWithTelegram();

  if (users.length === 0) {
    logger.warn('Nenhum usuário com Telegram encontrado');
    return;
  }

  logger.info(`Encontrados ${users.length} usuários com Telegram. Iniciando envio de lembretes.`, {
    correlationId
  });

  for (const user of users) {
    logger.debug(`Processando usuário: ${user.user_id}`, { correlationId });
    await checkUserReminders(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Verificação de lembretes concluída', { correlationId });
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
    const shouldSend = await shouldSendNotification(userId, null, 'daily_digest');
    if (!shouldSend) {
      logger.debug(`Daily digest suppressed by deduplication`, { userId });
      return;
    }

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
    message += `📅 ${escapeMarkdownV2(dateStr)}\n\n`;
    message += `✅ Doses tomadas: ${takenDoses}/${expectedDoses}\n`;
    message += `📈 Taxa de adesão: ${percentage}%\n\n`;

    if (percentage === 100) {
      message += '🎉 *Parabéns\\! Você completou todas as doses hoje\\!*';
    } else if (percentage >= 80) {
      message += '👍 *Bom trabalho\\! Continue assim\\!*';
    } else if (percentage >= 50) {
      message += '⚠️ *Atenção\\! Tome as doses restantes\\!*';
    } else {
      message += '🚨 *Cuidado\\! Você está atrasado nas doses\\.*';
    }

    const result = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    
    if (!result.success) {
      logger.error(`Falha ao enviar resumo diário`, {
        userId,
        chatId,
        error: result.error
      });
      return;
    }
    
    logger.info(`Resumo diário enviado com sucesso`, { userId, percentage, chatId, messageId: result.messageId });
    const logged = await logSuccessfulNotification(userId, null, 'daily_digest', { messageId: result.messageId });
    if (!logged) {
      logger.warn('Falha ao registrar log de notificação para resumo diário.', { userId, messageId: result.messageId });
    }

  } catch (err) {
    logger.error(`Error sending daily digest`, err, { userId });
  }
}

/**
 * Run daily digest for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function runDailyDigest(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  logger.info('Iniciando resumo diário para todos os usuários', { correlationId });

  const users = await getAllUsersWithTelegram();

  logger.info(`Enviando resumo diário para ${users.length} usuário(s)`, { correlationId });

  for (const user of users) {
    logger.debug(`Enviando resumo diário para usuário: ${user.user_id}`, { correlationId });
    await runUserDailyDigest(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Resumo diário concluído', { correlationId });
}

/**
 * Check stock alerts for a specific user
 */
async function checkUserStockAlerts(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) return;

    // Get user name for proactive messages
    const { data: userData } = await supabase
      .from('profiles')
      .select('first_name, name')
      .eq('id', userId)
      .single();
    const userName = userData?.first_name || userData?.name || 'aí';

    // Fetch medicines (with stock and protocols) and recent logs in parallel
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [{ data: medicines }, { data: recentLogs }] = await Promise.all([
      supabase
        .from('medicines')
        .select(`
          *,
          stock(*),
          protocols!protocols_medicine_id_fkey(*)
        `)
        .eq('user_id', userId),
      supabase
        .from('medicine_logs')
        .select('medicine_id, quantity_taken, taken_at')
        .eq('user_id', userId)
        .gte('taken_at', thirtyDaysAgo.toISOString()),
    ]);

    if (!medicines || medicines.length === 0) return;

    const logs = recentLogs || [];
    const lowStockMedicines = [];      // 1-7 days (critical)
    const zeroStockMedicines = [];     // 0 days (out of stock)
    const proactiveStockMedicines = []; // 8-14 days (proactive reminder)

    for (const medicine of medicines) {
      const activeProtocols = (medicine.protocols || []).filter(p => p.active);
      if (activeProtocols.length === 0) continue;

      const totalQuantity = (medicine.stock || []).reduce((sum, s) => sum + s.quantity, 0);
      const theoreticalDailyUsage = activeProtocols.reduce((sum, p) => {
        const timesPerDay = p.time_schedule?.length || 0;
        const dosagePerIntake = p.dosage_per_intake || 0;
        return sum + (timesPerDay * dosagePerIntake);
      }, 0);

      // Usar consumo real se disponivel, caso contrario teorico (INT-02, Option A)
      const { dailyConsumption, isRealData } = calcBotRealDailyConsumption(
        medicine.id,
        logs,
        theoreticalDailyUsage
      );

      const daysRemaining = calculateDaysRemaining(totalQuantity, dailyConsumption);
      const predictedStockoutDate = daysRemaining !== null && daysRemaining > 0
        ? formatStockoutDate(daysRemaining)
        : null;

      logger.debug(`Estoque ${medicine.name}: ${daysRemaining} dias (${isRealData ? 'real' : 'teorico'})`, { userId });

      if (daysRemaining !== null && daysRemaining <= 0) {
        zeroStockMedicines.push({ name: medicine.name, days: daysRemaining });
      } else if (daysRemaining !== null && daysRemaining <= 7) {
        lowStockMedicines.push({ name: medicine.name, days: daysRemaining, predictedStockoutDate });
      } else if (daysRemaining !== null && daysRemaining <= 14) {
        // Proactive tier: 8-14 days
        proactiveStockMedicines.push({ name: medicine.name, days: Math.round(daysRemaining), predictedStockoutDate });
      }
    }

    // Priority 1: Critical alerts (0-7 days)
    if (lowStockMedicines.length > 0 || zeroStockMedicines.length > 0) {
      await sendStockNotificationAlert({
        userId,
        chatId,
        notificationType: 'stock_alert',
        formatMessage: () => formatStockAlertMessage(zeroStockMedicines, lowStockMedicines),
        bot,
        dlqPayload: {
          lowStockCount: lowStockMedicines.length,
          zeroStockCount: zeroStockMedicines.length
        },
        logContext: {
          low: lowStockMedicines.length,
          zero: zeroStockMedicines.length
        }
      });
    }

    // Priority 2: Proactive alerts (8-14 days) - only if no critical alerts sent
    if (proactiveStockMedicines.length > 0 && lowStockMedicines.length === 0 && zeroStockMedicines.length === 0) {
      await sendStockNotificationAlert({
        userId,
        chatId,
        notificationType: 'proactive_stock_alert',
        formatMessage: () => formatProactiveStockMessage(userName, proactiveStockMedicines),
        bot,
        dlqPayload: {
          medicineCount: proactiveStockMedicines.length
        },
        logContext: {
          medicines: proactiveStockMedicines.length
        }
      });
    }

  } catch (err) {
    logger.error(`Error checking stock alerts`, err, { userId });
  }
}

/**
 * Check stock alerts for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkStockAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  logger.info('Iniciando alertas de estoque para todos os usuários', { correlationId });

  const users = await getAllUsersWithTelegram();

  logger.info(`Verificando alertas de estoque para ${users.length} usuário(s)`, { correlationId });

  for (const user of users) {
    logger.debug(`Verificando estoque para usuário: ${user.user_id}`, { correlationId });
    await checkUserStockAlerts(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Alertas de estoque concluídos', { correlationId });
}

/**
 * Check adherence reports for ALL users (weekly)
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkAdherenceReports(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  logger.info('Iniciando relatórios de adesão para todos os usuários', { correlationId });

  try {
    const users = await getAllUsersWithTelegram();
    logger.info(`Enviando relatórios semanais para ${users.length} usuário(s)`, { correlationId });

    for (const user of users) {
      try {
        logger.debug(`Enviando relatório semanal para usuário: ${user.user_id}`, { correlationId });
        await runUserWeeklyAdherenceReport(bot, user.user_id, user.telegram_chat_id);
      } catch (err) {
        logger.error(`Erro ao enviar relatório de adesão`, err, { userId: user.user_id, correlationId });
      }
    }

    logger.info('Relatórios de adesão concluídos', { correlationId });
  } catch (err) {
    logger.error('Falha ao executar relatórios de adesão', err, { correlationId });
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
    const shouldSend = await shouldSendNotification(userId, null, 'weekly_adherence');
    if (!shouldSend) {
      logger.debug(`Weekly adherence report suppressed by deduplication`, { userId });
      return;
    }

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
      message += '🎉 *Excelente\\! Você está muito bem com seu tratamento\\!*';
    } else if (percentage >= 70) {
      message += '👍 *Bom trabalho\\!* Continue se esforçando para melhorar\\.';
    } else {
      message += '⚠️ *Atenção\\!* Tente melhorar sua regularidade nas doses\\.';
    }

    const result = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    
    if (!result.success) {
      logger.error(`Falha ao enviar relatório semanal de adesão`, {
        userId,
        chatId,
        error: result.error
      });
      return;
    }
    
    logger.info(`Relatório semanal de adesão enviado com sucesso`, { userId, percentage, chatId, messageId: result.messageId });
    const logged = await logSuccessfulNotification(userId, null, 'weekly_adherence', { messageId: result.messageId });
    if (!logged) {
      logger.warn('Falha ao registrar log de relatório semanal.', { userId, messageId: result.messageId });
    }

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
      const shouldSend = await shouldSendNotification(userId, protocol.id, 'titration_alert');
      if (!shouldSend) {
        logger.debug(`Titration alert suppressed by deduplication`, {
          userId,
          protocolId: protocol.id,
          medicine: protocol.medicine?.name
        });
        continue;
      }

      const message = formatTitrationAlertMessage(protocol);

      const result = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
      
      if (!result.success) {
        logger.error(`Falha ao enviar alerta de titulação`, {
          userId,
          medicine: protocol.medicine?.name,
          protocolId: protocol.id,
          chatId,
          error: result.error
        });
        continue;
      }
      
      logger.info(`Alerta de titulação enviado com sucesso`, {
        userId,
        medicine: protocol.medicine?.name,
        protocolId: protocol.id,
        chatId,
        messageId: result.messageId
      });
      const logged = await logSuccessfulNotification(userId, protocol.id, 'titration_alert', { messageId: result.messageId });
      if (!logged) {
        logger.warn('Falha ao registrar log de alerta de titulação.', { userId, protocolId: protocol.id, messageId: result.messageId });
      }
    }

  } catch (err) {
    logger.error(`Error checking titration alerts`, err, { userId });
  }
}

/**
 * Check titration alerts for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkTitrationAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  logger.info('Iniciando alertas de titulação para todos os usuários', { correlationId });

  const users = await getAllUsersWithTelegram();

  logger.info(`Verificando alertas de titulação para ${users.length} usuário(s)`, { correlationId });

  for (const user of users) {
    logger.debug(`Verificando titulações para usuário: ${user.user_id}`, { correlationId });
    await checkUserTitrationAlerts(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Alertas de titulação concluídos', { correlationId });
}

/**
 * Check monthly reports for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkMonthlyReport(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  logger.info('Iniciando relatórios mensais para todos os usuários', { correlationId });

  try {
    const users = await getAllUsersWithTelegram();
    logger.info(`Enviando relatórios mensais para ${users.length} usuário(s)`, { correlationId });

    for (const user of users) {
      try {
        logger.debug(`Enviando relatório mensal para usuário: ${user.user_id}`, { correlationId });
        await runUserMonthlyReport(bot, user.user_id, user.telegram_chat_id);
      } catch (err) {
        logger.error(`Erro ao enviar relatório mensal`, err, { userId: user.user_id, correlationId });
      }
    }

    logger.info('Relatórios mensais concluídos', { correlationId });
  } catch (err) {
    logger.error('Falha ao executar relatórios mensais', err, { correlationId });
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
    const shouldSend = await shouldSendNotification(userId, null, 'monthly_report');
    if (!shouldSend) {
      logger.debug(`Monthly report suppressed by deduplication`, { userId });
      return;
    }

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
      message += '🏆 *Parabéns\\!* Mês excelente de tratamento\\!';
    } else if (percentage >= 70) {
      message += '👍 *Bom trabalho\\!* Você está no caminho certo\\.';
    } else {
      message += '💪 *Vamos melhorar\\!* O próximo mês será melhor\\.';
    }

    const result = await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    
    if (!result.success) {
      logger.error(`Falha ao enviar relatório mensal`, {
        userId,
        chatId,
        error: result.error
      });
      return;
    }
    
    logger.info(`Relatório mensal enviado com sucesso`, { userId, percentage, chatId, messageId: result.messageId });
    const logged = await logSuccessfulNotification(userId, null, 'monthly_report', { messageId: result.messageId });
    if (!logged) {
      logger.warn('Falha ao registrar log de relatório mensal.', { userId, messageId: result.messageId });
    }

  } catch (err) {
    logger.error(`Error sending monthly report`, err, { userId });
  }
}

// --- DLQ Digest ---

const DLQ_DIGEST_LIMIT = 10;
const ERROR_MESSAGE_TRUNCATE_LENGTH = 50;

/**
 * Envia digest diário de notificações falhadas para o admin
 * @param {object} bot - Bot adapter
 * @param {object} options - Options with correlationId
 * @returns {Promise<object>} Resultado da operação
 */
export async function sendDLQDigest(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  try {
    // Buscar notificações falhadas pendentes (inclui retrying)
    const { data: failedNotifications, error } = await supabase
      .from('failed_notification_queue')
      .select('*')
      .in('status', ['pending', 'retrying'])
      .order('created_at', { ascending: false })
      .limit(DLQ_DIGEST_LIMIT);
    
    if (error) {
      logger.error('Erro ao buscar notificações falhadas', { correlationId, error });
      return { sent: false, reason: 'query_failed', error: error.message };
    }
    
    if (!failedNotifications || failedNotifications.length === 0) {
      logger.debug('No failed notifications in DLQ', { correlationId });
      return { sent: false, reason: 'no_failures' };
    }
    
    // Verificar se ADMIN_CHAT_ID está configurado
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (!adminChatId) {
      logger.warn('ADMIN_CHAT_ID not configured, skipping DLQ digest', { correlationId });
      return { sent: false, reason: 'no_admin_chat_id' };
    }
    
    // Formatar mensagem
    const message = formatDLQDigestMessage(failedNotifications);
    
    // Enviar digest
    const result = await bot.sendMessage(adminChatId, message, { parse_mode: 'MarkdownV2' });
    
    if (!result.success) {
      logger.error('Failed to send DLQ digest', { 
        correlationId, 
        error: result.error,
        count: failedNotifications.length 
      });
      return { sent: false, reason: 'send_failed', error: result.error };
    }
    
    logger.info('DLQ digest sent', { 
      correlationId, 
      count: failedNotifications.length,
      messageId: result.messageId 
    });
    
    return { sent: true, count: failedNotifications.length, messageId: result.messageId };
    
  } catch (err) {
    logger.error('Error in sendDLQDigest', err, { correlationId });
    return { sent: false, reason: 'exception', error: err.message };
  }
}

/**
 * Formata mensagem de digest do DLQ
 * @param {Array} notifications - Lista de notificações falhadas
 * @returns {string} Mensagem formatada em MarkdownV2
 */
function formatDLQDigestMessage(notifications) {
  const count = notifications.length;
  const header = `⚠️ *DLQ Digest: ${count} notificações falhadas*\n\n`;
  
  const items = notifications.map((n, i) => {
    const time = new Date(n.created_at).toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short'
    });
    const error = n.error_message?.substring(0, ERROR_MESSAGE_TRUNCATE_LENGTH) || 'Unknown error';
    const escapedError = escapeMarkdownV2(error);
    const escapedType = escapeMarkdownV2(n.notification_type || 'unknown');
    const escapedTime = escapeMarkdownV2(time);
    
    return `${i + 1}\\. \\[${escapedTime}\\]\n   Tipo: ${escapedType}\n   Erro: ${escapedError}`;
  }).join('\n\n');
  
  const footer = `\n\n_Acesse /admin/dlq para gerenciar_`;
  
  return header + items + footer;
}

// --- Prescription Alert Functions (F5.9) ---

/**
 * Format prescription alert message
 * @param {object} protocol - Protocol data
 * @param {number} daysRemaining - Days until prescription expires
 * @returns {string} Formatted message
 */
function formatPrescriptionAlertMessage(protocol, daysRemaining) {
  const medicine = protocol.medicine || {};
  const name = escapeMarkdownV2(medicine.name || 'Medicamento');
  const endDate = protocol.end_date 
    ? new Date(protocol.end_date).toLocaleDateString('pt-BR')
    : 'Data não definida';

  let message = '';
  
  if (daysRemaining === 1) {
    message = `⚠️ *Prescrição vence amanhã\\!*\n\n`;
  } else if (daysRemaining === 7) {
    message = `⚠️ *Prescrição vencendo em 7 dias*\n\n`;
  } else if (daysRemaining === 30) {
    message = `📋 *Renovação de Prescrição*\n\n`;
  } else {
    message = `⚠️ *Prescrição próxima do vencimento*\n\n`;
  }

  message += `Protocolo: **${name}**\n`;
  message += `Vencimento: ${escapeMarkdownV2(endDate)}\n\n`;

  if (daysRemaining <= 1) {
    message += `🚨 *Atenção\\!* Renove sua prescrição o quanto antes para evitar interrupção no tratamento\\.`;
  } else if (daysRemaining <= 7) {
    message += `📅 Agende sua consulta para renovar a prescrição\\.`;
  } else {
    message += `💡 É um bom momento para agendar sua consulta de acompanhamento\\.`;
  }

  return message;
}

/**
 * Check prescription alerts for a specific user
 */
async function checkUserPrescriptionAlerts(bot, userId, chatId) {
  try {
    const settings = await getUserSettings(userId, true);
    if (!settings) return;

    const timezone = settings.timezone || 'America/Sao_Paulo';
    const today = getCurrentDateInTimezone(timezone);
    const todayDate = new Date(today + 'T00:00:00');

    // Get active protocols with end_date set
    const { data: protocols } = await supabase
      .from('protocols')
      .select(`
        *,
        medicine:medicines(name, dosage_unit)
      `)
      .eq('user_id', userId)
      .eq('active', true)
      .not('end_date', 'is', null);

    if (!protocols || protocols.length === 0) return;

    for (const protocol of protocols) {
      const endDate = new Date(protocol.end_date + 'T00:00:00');
      const diffTime = endDate.getTime() - todayDate.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Only alert at 30, 7, and 1 day(s) before expiration
      const alertDays = [30, 7, 1];
      if (!alertDays.includes(daysRemaining)) {
        continue;
      }

      // Determine notification type based on days remaining
      const notificationType = `prescription_alert_${daysRemaining}d`;

      // Check deduplication
      const shouldSend = await shouldSendNotification(userId, protocol.id, notificationType);
      if (!shouldSend) {
        logger.debug(`Prescription alert suppressed by deduplication`, {
          userId,
          protocolId: protocol.id,
          medicine: protocol.medicine?.name,
          daysRemaining
        });
        continue;
      }

      const message = formatPrescriptionAlertMessage(protocol, daysRemaining);

      // Create inline keyboard with deep link to protocol
      const keyboard = {
        inline_keyboard: [
          [
            { 
              text: '📋 Ver Protocolo', 
              url: `https://meusremedios.app/#/protocolos/${protocol.id}` 
            }
          ]
        ]
      };

      const result = await bot.sendMessage(chatId, message, { 
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard
      });
      
      if (!result.success) {
        logger.error(`Falha ao enviar alerta de prescrição`, {
          userId,
          medicine: protocol.medicine?.name,
          protocolId: protocol.id,
          chatId,
          daysRemaining,
          error: result.error
        });

        // Enviar para DLQ para retry
        const correlationId = result.correlationId || getCurrentCorrelationId();
        await enqueue(
          {
            userId,
            protocolId: protocol.id,
            type: notificationType,
            chatId,
            payload: {
              medicineName: protocol.medicine?.name,
              daysRemaining
            }
          },
          result.error,
          result.attempts || 1,
          correlationId
        );
        continue;
      }
      
      logger.info(`Alerta de prescrição enviado com sucesso`, {
        userId,
        medicine: protocol.medicine?.name,
        protocolId: protocol.id,
        chatId,
        daysRemaining,
        messageId: result.messageId
      });
      
      const logged = await logSuccessfulNotification(userId, protocol.id, notificationType, { 
        messageId: result.messageId,
        daysRemaining
      });
      
      if (!logged) {
        logger.warn('Falha ao registrar log de alerta de prescrição.', { 
          userId, 
          protocolId: protocol.id, 
          messageId: result.messageId 
        });
      }
    }

  } catch (err) {
    logger.error(`Error checking prescription alerts`, err, { userId });
  }
}

/**
 * Check prescription alerts for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkPrescriptionAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  
  logger.info('Iniciando alertas de prescrição para todos os usuários', { correlationId });
  
  const users = await getAllUsersWithTelegram();
  
  logger.info(`Verificando alertas de prescrição para ${users.length} usuário(s)`);
  
  for (const user of users) {
    logger.debug(`Verificando prescrições para usuário: ${user.user_id}`);
    await checkUserPrescriptionAlerts(bot, user.user_id, user.telegram_chat_id);
  }

  logger.info('Alertas de prescrição concluídos', { correlationId });
}