import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { ErrorCategories } from '../services/deadLetterQueue.js';
import { getCurrentCorrelationId } from './correlationLogger.js';
import {
  getActiveProtocols
} from '../services/protocolCache.js';
import { shouldSendNotification, shouldSendGroupedNotification } from '../services/notificationDeduplicator.js';
import {
  getCurrentTimeInTimezone,
  getCurrentDateInTimezone
} from '../utils/timezone.js';
import { escapeMarkdownV2 } from '../utils/formatters.js';
import { partitionDoses } from './utils/partitionDoses.js';
import { parseLocalDate, formatLocalDate } from '../utils/dateUtils.js';


const logger = createLogger('Tasks');

/**
 * Retorna uma saudação baseada na hora do dia
 * @param {number} hour - Hora local (0-23)
 * @returns {string}
 */
function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
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
 * Check reminders via dispatcher com agrupamento por treatment_plan (Wave N1).
 *
 * Substitui o loop "1 dispatch por protocolo" por partição semântica:
 *   - 1 dispatch por plano com ≥2 doses (dose_reminder_by_plan)
 *   - 1 dispatch consolidado para sobra ≥2 sem plano (dose_reminder_misc)
 *   - 1 dispatch individual para dose única (dose_reminder)
 *
 * ADR-029, ADR-030. R-031 (escapeMarkdownV2). R-030 (callback_data <64 bytes).
 */
async function checkRemindersViaDispatcher(dispatcher, correlationId) {
  try {
    // R-111: Buscar apenas usuários ativos (evita queries em massa na auth.users)
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode, quiet_hours_start, quiet_hours_end');

    if (userError) throw userError;

    // WAVE 11: Filtrar usuários que não estão no modo realtime
    // Silent: sem notificações
    // Digest: notificações individuais suprimidas (recebe apenas o resumo matinal)
    const realtimeUsers = (users || []).filter(u => u.notification_mode === 'realtime');

    if (realtimeUsers.length === 0) {
      logger.info('Nenhum usuário em modo realtime encontrado para dispatch de lembretes unitários', { correlationId });
      return;
    }

    logger.info(`Iniciando verificação de lembretes para ${realtimeUsers.length} usuários em modo realtime`, { correlationId });

    // Otimização Wave 12: Agrupar usuários por HHMM local para busca otimizada via JSONB (@>)
    // R-020: Usamos Map para garantir consistência de tempo por usuário (evita minute-flip race)
    const userTimes = new Map();
    const userIdsByHHMM = {};
    
    for (const user of realtimeUsers) {

      const timezone = user.timezone || 'America/Sao_Paulo';
      // Sanitização: remove caracteres de controle do Intl (ex: \u202f no Node 18+) que quebram JSONB
      const currentHHMM = getCurrentTimeInTimezone(timezone).replace(/[^\d:]/g, ''); 
      userTimes.set(user.user_id, currentHHMM);
      
      if (!userIdsByHHMM[currentHHMM]) userIdsByHHMM[currentHHMM] = [];
      userIdsByHHMM[currentHHMM].push(user.user_id);
    }

    const allProtocols = [];
    for (const [hhmm, ids] of Object.entries(userIdsByHHMM)) {
      // Otimização: Batching de IDs (lotes de 50) para evitar limites de URL (414 Request-URI Too Large)
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50);
        const { data, error } = await supabase
          .from('protocols')
          .select(`
            id,
            user_id,
            name,
            time_schedule,
            medicine_id,
            dosage_per_intake,
            treatment_plan_id,
            medicine:medicines(name),
            treatment_plan:treatment_plans(id, name)
          `)
          .in('user_id', chunk)
          .eq('active', true)
          // Fix Wave 12: JSON.stringify garante sintaxe correta para JSONB @> no PostgREST
          .contains('time_schedule', JSON.stringify([hhmm])); 

        if (error) {
          logger.error(`Erro ao buscar protocolos para HHMM ${hhmm} (Batch ${Math.floor(i/50) + 1})`, error, { correlationId });
          continue;
        }
        if (data) allProtocols.push(...data);
      }
    }

    // Agrupar por user_id em memória (para facilitar o loop de dispatch por usuário)
    const protocolsByUser = {};
    for (const p of allProtocols) {
      if (!protocolsByUser[p.user_id]) protocolsByUser[p.user_id] = [];
      protocolsByUser[p.user_id].push(p);
    }

    for (const user of realtimeUsers) {
      const userId = user.user_id;

      try {
        // Recupera o tempo calculado no início para manter consistência com a query
        const currentHHMM = userTimes.get(userId);
        const currentHour = parseInt(currentHHMM.split(':')[0], 10);
        const protocols = protocolsByUser[userId] || [];
        if (protocols.length === 0) continue;

        // Coletar doses ativas neste minuto
        const dosesNow = protocols
          .filter(p => (p.time_schedule || []).includes(currentHHMM))
          .map(p => ({
            protocolId: p.id,
            protocolName: p.name,
            medicineName: p.medicine?.name || 'Medicamento',
            treatmentPlanId: p.treatment_plan_id ?? null,
            treatmentPlanName: p.treatment_plan?.name ?? null,
            dosagePerIntake: p.dosage_per_intake ?? 1,
            medicineId: p.medicine_id,
          }));

        if (dosesNow.length === 0) continue;

        // Particionar em blocos semânticos (cenários A–I)
        const blocks = partitionDoses(dosesNow);

        logger.info(`${dosesNow.length} dose(s) → ${blocks.length} bloco(s) para userId=${userId} às ${currentHHMM}`, {
          correlationId,
          userId,
          blockKinds: blocks.map(b => b.kind),
        });

        for (const block of blocks) {
          // Verificar deduplicação para blocos agrupados
          const normalizedKind = block.kind?.toLowerCase();
          if (['by_plan', 'misc'].includes(normalizedKind)) {
            const notificationType = 'dose_reminder_' + normalizedKind;
            const options = normalizedKind === 'by_plan' ? { planId: block.planId } : {};
            const shouldSend = await shouldSendGroupedNotification(userId, notificationType, options);
            if (!shouldSend) {
              const logContext = { userId, correlationId };
              if (block.planId) {
                logContext.planId = block.planId;
              }
              logger.debug('Dose reminder ' + normalizedKind + ' suprimido por deduplicação', logContext);
              continue;
            }
          }

          let kind, data;

          if (block.kind === 'by_plan') {
            kind = 'dose_reminder_by_plan';
            data = {
              planId: block.planId,
              planName: block.planName,
              scheduledTime: currentHHMM,
              hour: currentHour,
              doses: block.doses,
              protocolIds: block.doses.map(d => d.protocolId),
            };
          } else if (block.kind === 'misc') {
            kind = 'dose_reminder_misc';
            data = {
              scheduledTime: currentHHMM,
              hour: currentHour,
              doses: block.doses,
              protocolIds: block.doses.map(d => d.protocolId),
            };
          } else {
            // individual
            const dose = block.doses[0];
            kind = 'dose_reminder';
            data = {
              medicineName: dose.medicineName,
              protocolId: dose.protocolId,
              medicineId: dose.medicineId,
              dosage: dose.dosagePerIntake,
            };
          }

          const result = await dispatcher.dispatch({
            userId,
            kind,
            data,
            context: { correlationId, jobType: 'dose_reminder_dispatcher' },
          });

          if (!result.success) {
            logger.error('Falha no dispatch do bloco de dose', null, {
              userId,
              kind,
              planId: block.planId,
              errors: result.errors,
              correlationId,
            });
          }
        }
      } catch (err) {
        logger.error('Erro ao processar lembretes do usuário via dispatcher', err, { userId, correlationId });
      }
    }

    logger.info('CheckReminders (Dispatcher) concluído', { correlationId });
  } catch (err) {
    logger.error('Erro crítico em checkRemindersViaDispatcher', err, { correlationId });
  }
}



/**
 * Check reminders for ALL users (cron job)
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkReminders(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkReminders. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando verificação de lembretes via Dispatcher (ADR-030)', { correlationId });
  return checkRemindersViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Run daily digest via dispatcher (Sprint 6.4 — ADR-029, ADR-030)
 */
async function runDailyDigestViaDispatcher(dispatcher, correlationId) {
  try {
    // Bug B7: auth.users não é acessível pelo client JS — usar user_settings
    // Aproveitar para pré-carregar settings e evitar N+1 de getUserSettings()
    const { data: usersRaw } = await supabase
      .from('user_settings')
      .select('user_id, notification_mode, digest_time, timezone, display_name')
      .eq('notification_mode', 'digest_morning');

    const users = usersRaw ?? [];
    if (users.length === 0) {
      logger.debug('Daily digest: nenhum usuário em modo digest_morning', { correlationId });
      return;
    }

    logger.info(`Running daily digest via dispatcher for ${users.length} users`, { correlationId });

    // Fase 1: filtrar usuários cujo digest_time bate com o horário atual
    const eligibleEntries = [];
    for (const user of users) {
      const userId = user.user_id;
      try {
        const timezone = user.timezone || 'America/Sao_Paulo';
        // Bug B-formato: Postgres TIME retorna '14:00:00' (com segundos)
        // getCurrentTimeInTimezone retorna 'HH:MM' — fatiar para comparar
        const digestTime = (user.digest_time || '07:00').slice(0, 5);
        const currentHHMM = getCurrentTimeInTimezone(timezone);

        logger.debug(`Evaluating user ${userId} (${user.display_name})`, { 
          timezone, 
          digestTime, 
          currentHHMM, 
          match: currentHHMM === digestTime,
          correlationId 
        });

        if (currentHHMM !== digestTime) continue;

        const shouldSend = await shouldSendNotification(userId, null, 'daily_digest');
        if (!shouldSend) {
          logger.debug(`Daily digest suppressed by deduplication`, { userId, correlationId });
          continue;
        }

        eligibleEntries.push({ 
          userId, 
          timezone, 
          displayName: user.display_name,
          digestTime 
        });
      } catch (err) {
        logger.error(`Error evaluating daily digest eligibility for user`, err, { userId, correlationId });
      }
    }

    if (eligibleEntries.length === 0) {
      logger.info('Daily digest: no eligible users at this time', { correlationId });
      return;
    }

    // Fase 2: bulk-fetch de protocolos para todos os usuários elegíveis (evita N+1)
    const eligibleIds = eligibleEntries.map(e => e.userId);
    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(name, dosage_unit)')
      .in('user_id', eligibleIds)
      .eq('active', true);

    const protocolsByUser = {};
    for (const p of allProtocols ?? []) {
      if (!protocolsByUser[p.user_id]) protocolsByUser[p.user_id] = [];
      protocolsByUser[p.user_id].push(p);
    }

    // Fase 3: dispatch por usuário com dados já em memória
    for (const { userId, timezone, displayName, digestTime } of eligibleEntries) {
      try {
        const dateToday = getCurrentDateInTimezone(timezone);
        const dateTodayStart = parseLocalDate(dateToday);
        const dateYesterdayDate = new Date(dateTodayStart);
        dateYesterdayDate.setDate(dateYesterdayDate.getDate() - 1);
        const dateYesterday = formatLocalDate(dateYesterdayDate);

        // Buscar logs de ontem para o nudge motivacional (Wave 12)
        const { data: logs } = await supabase
          .from('medicine_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('taken_at', dateYesterdayDate.toISOString())
          .lt('taken_at', dateTodayStart.toISOString());

        const yesterdayLogs = logs || [];
        const protocols = protocolsByUser[userId] || [];
        
        // Cálculo de Score de Ontem
        const expectedDosesYesterday = protocols.reduce((sum, p) => {
          // Filtrar protocolos que já estavam ativos ontem
          if (p.start_date && p.start_date > dateYesterday) return sum;
          return sum + (p.time_schedule?.length || 0);
        }, 0);
        const takenDosesYesterday = yesterdayLogs.length;
        const percentageYesterday = expectedDosesYesterday > 0 ? Math.min(100, Math.round((takenDosesYesterday / expectedDosesYesterday) * 100)) : 0;

        // Agenda de Hoje
        const todaySchedule = [];
        protocols.forEach(p => {
          (p.time_schedule || []).forEach(time => {
            todaySchedule.push({
              time,
              medicineName: p.medicine?.name || p.name,
              dosage: p.dosage_per_intake || 1,
              unit: p.medicine?.dosage_unit || 'dose'
            });
          });
        });
        todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

        const currentHour = parseInt(digestTime.split(':')[0], 10);
        const greeting = getGreeting(currentHour);
        const dateStr = dateTodayStart.toLocaleDateString('pt-BR');
        
        // Template Rico (Telegram / Inbox) - Planejador Matinal
        const richTitle = `📅 Seu Planejador — ${dateStr}`;
        let richBody = `${escapeMarkdownV2(greeting)}, ${escapeMarkdownV2(displayName || 'Paciente')}\\! 👋\n\n`;
        
        if (expectedDosesYesterday > 0) {
          richBody += `📊 **Ontem:** você completou ${percentageYesterday}% das doses\\. `;
          richBody += percentageYesterday === 100 ? 'Excelente\\! 🌟' : 'Vamos manter o foco hoje? 💪';
          richBody += `\n\n`;
        }

        if (todaySchedule.length > 0) {
          richBody += `🕒 **Sua Agenda de Hoje:**\n`;
          todaySchedule.forEach(s => {
            richBody += `• ${s.time} — ${escapeMarkdownV2(s.medicineName)} \\(${s.dosage} ${escapeMarkdownV2(s.unit)}\\)\n`;
          });
        } else {
          richBody += `✨ Você não tem doses agendadas para hoje\\. Aproveite o descanso\\!`;
        }

        // Template Compacto (Push) - Sem escapes Markdown
        const pushBody = `${greeting}! Ontem: ${percentageYesterday}%. Hoje você tem ${todaySchedule.length} doses agendadas. Vamos nessa?`;

        await dispatcher.dispatch({
          userId,
          kind: 'daily_digest',
          payload: {
            title: richTitle,
            body: richBody,
            pushBody,
            metadata: {
              summary: `${dateStr} — ${todaySchedule.length} doses`,
              yesterdayPercentage: percentageYesterday,
              scheduleCount: todaySchedule.length,
              greeting
            }
          },
          context: { correlationId, jobType: 'daily_digest' }
        });

      } catch (err) {
        logger.error(`Error processing daily digest for user`, err, { userId, correlationId });
      }
    }
  } catch (error) {
    logger.error('Error in runDailyDigestViaDispatcher', error, { correlationId });
  }
}

/**
 * Relatório Diário de Adesão (Fase 12)
 * Disparado às 23:00 para todos os usuários (estratégia Inbox-First).
 * Foca em analytics e reforço positivo.
 */
async function runDailyAdherenceReportViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users } = await supabase
      .from('user_settings')
      .select('user_id, timezone, display_name, digest_time, notification_mode')
      .neq('notification_mode', 'silent');


    if (!users || users.length === 0) return;

    const eligibleUsers = [];
    for (const user of users) {
      try {
        const timezone = user.timezone || 'America/Sao_Paulo';
        const currentHHMM = getCurrentTimeInTimezone(timezone);
        // Default para 23:00 se não houver digest_time definido
        const targetTime = (user.digest_time || '23:00').slice(0, 5);

        if (currentHHMM !== targetTime) continue;

        const shouldSend = await shouldSendNotification(user.user_id, null, 'adherence_report');
        if (!shouldSend) continue;

        eligibleUsers.push(user);
      } catch (err) {
        logger.error(`Error evaluating adherence report eligibility for user`, err, { userId: user.user_id, correlationId });
      }
    }

    if (eligibleUsers.length === 0) return;

    logger.info(`Running daily adherence report for ${eligibleUsers.length} users`, { correlationId });

    const userIds = eligibleUsers.map(u => u.user_id);
    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(name)')
      .in('user_id', userIds)
      .eq('active', true);

    const protocolsByUser = {};
    for (const p of allProtocols ?? []) {
      if (!protocolsByUser[p.user_id]) protocolsByUser[p.user_id] = [];
      protocolsByUser[p.user_id].push(p);
    }

    for (const user of eligibleUsers) {
      const { user_id: userId, timezone, display_name: displayName } = user;
      try {
        const dateToday = getCurrentDateInTimezone(timezone || 'America/Sao_Paulo');
        const startOfDay = parseLocalDate(dateToday);
        const dateYesterdayDate = new Date(startOfDay);
        dateYesterdayDate.setDate(dateYesterdayDate.getDate() - 1);
        const startOfYesterday = formatLocalDate(dateYesterdayDate);
        
        const { data: logs } = await supabase
          .from('medicine_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('taken_at', dateYesterdayDate.toISOString());

        const todayLogs = logs?.filter(l => l.taken_at >= startOfDay.toISOString()) || [];
        const yesterdayLogs = logs?.filter(l => l.taken_at < startOfDay.toISOString() && l.taken_at >= dateYesterdayDate.toISOString()) || [];

        const protocols = protocolsByUser[userId] || [];
        if (protocols.length === 0) continue;

        const expectedDoses = protocols.reduce((sum, p) => sum + (p.time_schedule?.length || 0), 0);
        const takenDoses = todayLogs.length;
        const percentage = expectedDoses > 0 ? Math.min(100, Math.round((takenDoses / expectedDoses) * 100)) : 0;
        
        const expectedYesterday = protocols.reduce((sum, p) => {
          if (p.start_date && p.start_date > startOfYesterday) return sum;
          return sum + (p.time_schedule?.length || 0);
        }, 0);
        const percentageYesterday = expectedYesterday > 0 ? Math.min(100, Math.round((yesterdayLogs.length / expectedYesterday) * 100)) : 0;

        // Storytelling logic
        let storytelling = '';
        if (percentage > percentageYesterday) {
          storytelling = `📈 Melhora de ${percentage - percentageYesterday}% em relação a ontem\\!`;
        } else if (percentage < percentageYesterday && percentage > 0) {
          storytelling = `📉 Hoje foi um pouco mais difícil que ontem (${percentage}% vs ${percentageYesterday}%)\\.`;
        } else if (percentage === 100 && percentageYesterday === 100) {
          storytelling = `🌟 Segundo dia seguido com 100%\\!`;
        } else if (percentage === 0 && expectedDoses > 0) {
          storytelling = `🧘 Amanhã é uma nova oportunidade para cuidar de você\\.`;
        } else {
          storytelling = `⚖️ Mantendo a constância de ontem\\.`;
        }

        const nudge = getMotivationalNudge(percentage);
        const dateStr = startOfDay.toLocaleDateString('pt-BR');

        const title = `🌙 Resumo do seu Dia — ${dateStr}`;
        let body = `Olá, ${escapeMarkdownV2(displayName || 'Paciente')}\\! 👋\n\n`;
        body += `📊 **Hoje:** ${percentage}% das doses concluídas \\(${takenDoses}/${expectedDoses}\\)\\.\n`;
        body += `📈 **Comparação:** ${storytelling}\n\n`;
        body += `${escapeMarkdownV2(nudge)}\n\n`;

        if (percentage === 100) {
          body += `🏆 **Excelência\\!** Amanhã seguimos firmes\\.`;
        } else {
          body += `💡 Amanhã é uma nova chance de brilhar\\!`;
        }

        // Template Compacto (Push) - Sem escapes Markdown
        const pushBody = `🌙 Resumo: ${percentage}% concluído hoje. ${storytelling.replace(/\\/g, '')} Prepare-se para amanhã!`;

        await dispatcher.dispatch({
          userId,
          kind: 'adherence_report',
          payload: {
            title,
            body,
            pushBody,
            metadata: {
              summary: `${dateStr} — ${percentage}%`,
              percentage,
              taken_doses: takenDoses,
              expected_doses: expectedDoses,
              nudge,
              storytelling,
              details: protocols.map(p => ({
                name: p.medicine?.name || 'Medicamento',
                protocol_id: p.id,
                taken: todayLogs.filter(l => l.protocol_id === p.id).length || 0,
                expected: p.time_schedule?.length || 1
              }))
            }
          },
          context: { correlationId, jobType: 'adherence_report' }
        });

      } catch (err) {
        logger.error(`Error processing daily adherence report for user`, err, { userId, correlationId });
      }
    }
  } catch (error) {
    logger.error('Error in runDailyAdherenceReportViaDispatcher', error, { correlationId });
  }
}

/**
 * Helper para Mensagens Motivacionais (Behavioral Nudges)
 */
function getMotivationalNudge(percentage) {
  if (percentage === 100) {
    const wins = [
      "🏆 Imbatível! Sua saúde agradece por tanto compromisso.",
      "🌟 Brilhante! 100% de adesão é o caminho para o sucesso.",
      "✅ Missão cumprida! Você é um exemplo de dedicação."
    ];
    return wins[Math.floor(Math.random() * wins.length)];
  } else if (percentage >= 80) {
    return "📈 Quase lá! Você está indo muito bem. Um pequeno ajuste e chegamos nos 100%!";
  } else if (percentage >= 50) {
    return "⚖️ No caminho certo. Cada dose conta para a sua melhora. Vamos subir essa média?";
  } else if (percentage > 0) {
    return "💪 Não desanime! O importante é recomeçar. Amanhã teremos uma nova chance.";
  } else {
    return "🧘 Respire fundo. Organizar sua rotina é o primeiro passo para o autocuidado.";
  }
}

/**
 * Run daily digest for a specific user
 */
export async function runDailyAdherenceReport(bot, { correlationId, notificationDispatcher }) {
  await runDailyAdherenceReportViaDispatcher(notificationDispatcher, correlationId);
}

export async function runDailyDigest(bot, { correlationId, notificationDispatcher }) {
  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para runDailyDigest. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando resumo diário via Dispatcher (ADR-030)', { correlationId });
  return runDailyDigestViaDispatcher(notificationDispatcher, correlationId);
}

export async function checkStockAlertsViaDispatcher(dispatcher, correlationId) {
  try {
    // 1. Buscar todos os usuários ativos com configurações (evita auth.users por causa do RLS)
    const { data: users, error: usersErr } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode');

    if (usersErr || !users || users.length === 0) {
      logger.info('Nenhum usuário encontrado em user_settings para alertas de estoque', { correlationId });
      return;
    }

    // WAVE 11: Respeitar o modo de notificação (Silent = nada)
    const eligibleUsers = users.filter(u => u.notification_mode !== 'silent');
    if (eligibleUsers.length === 0) return;

    const userIds = eligibleUsers.map(u => u.user_id);
    logger.info(`Verificando alertas de estoque para ${userIds.length} usuários elegíveis`, { correlationId });

    // 2. Buscar protocolos ativos para calcular consumo diário (ADR-022)
    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('user_id, medicine_id, time_schedule, dosage_per_intake')
      .eq('active', true)
      .in('user_id', userIds);

    // 3. Buscar saldo atual por medicamento (tabela 'stock', singular)
    const { data: allStock } = await supabase
      .from('stock')
      .select('user_id, medicine_id, quantity, medicine:medicines(name)')
      .in('user_id', userIds);

    // 4. Consolidar dados em memória para processamento eficiente
    const protocolsByMedicine = {};
    for (const p of allProtocols || []) {
      const key = `${p.user_id}_${p.medicine_id}`;
      if (!protocolsByMedicine[key]) protocolsByMedicine[key] = [];
      protocolsByMedicine[key].push(p);
    }

    const stockByMedicine = {};
    for (const s of allStock || []) {
      const key = `${s.user_id}_${s.medicine_id}`;
      if (!stockByMedicine[key]) stockByMedicine[key] = { qty: 0, name: s.medicine?.name || 'Medicamento' };
      stockByMedicine[key].qty += Number(s.quantity || 0);
    }

    // 5. Avaliar alertas e disparar via dispatcher
    for (const key in stockByMedicine) {
      const [userId, medicineId] = key.split('_');
      const stock = stockByMedicine[key];
      const protocols = protocolsByMedicine[key] || [];

      if (protocols.length === 0) continue; // Sem protocolos ativos, não alertamos consumo zero

      const dailyConsumption = protocols.reduce((sum, p) => {
        const intakesPerDay = (p.time_schedule || []).length;
        return sum + (intakesPerDay * (p.dosage_per_intake || 1));
      }, 0);

      if (dailyConsumption <= 0) continue;

      const daysRemaining = Math.floor(stock.qty / dailyConsumption);

      // Threshold: Alerta se faltar menos de 7 dias
      if (daysRemaining < 7) {
        logger.info(`Disparando alerta de estoque baixo: ${stock.name} (${daysRemaining} dias restantes)`, {
          userId, medicineId, correlationId
        });

        const richTitle = `📦 Alerta de Estoque: ${escapeMarkdownV2(stock.name)}`;
        const richBody = `📉 **Restam:** ${stock.qty} doses\\.\n⏳ **Previsão:** Acaba em aproximadamente **${daysRemaining} dias**\\.\n\nRecomendamos a reposição em breve\\.`;
        const pushBody = `📦 ${stock.name} acabando: restam ${stock.qty} doses (~${daysRemaining} dias)\\. Garanta sua reposição\\!`;

        await dispatcher.dispatch({
          userId,
          kind: 'stock_alert',
          payload: {
            title: richTitle,
            body: richBody,
            pushBody,
            metadata: {
              medicineId,
              medicineName: stock.name,
              daysRemaining,
              stockQuantity: stock.qty
            }
          },
          context: { correlationId, jobType: 'stock_alert_dispatcher' }
        });
      }
    }

    logger.info('Verificação de alertas de estoque concluída', { correlationId });
  } catch (err) {
    logger.error('Erro em checkStockAlertsViaDispatcher', err, { correlationId });
  }
}

/**
 * Check adherence reports for ALL users (weekly) via Dispatcher
 */
export async function checkAdherenceReportsViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    // WAVE 11: Respeitar o modo de notificação (Silent = nada)
    const eligibleUsers = users.filter(u => u.notification_mode !== 'silent');
    if (eligibleUsers.length === 0) return;

    logger.info(`Iniciando relatórios semanais via Dispatcher para ${eligibleUsers.length} usuários elegíveis`, { correlationId });

    for (const user of eligibleUsers) {
      const userId = user.user_id;
      
      // Cálculo de adesão (últimos 7 dias)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: logs } = await supabase
        .from('medicine_logs')
        .select('id')
        .eq('user_id', userId)
        .gte('taken_at', oneWeekAgo);

      const protocols = await getActiveProtocols(userId, true);
      const expectedDoses = protocols.reduce((sum, p) => {
        const intakesPerDay = (p.time_schedule || []).length;
        return sum + (intakesPerDay * 7);
      }, 0);
      
      const takenDoses = logs?.length || 0;
      const percentage = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0;

      await dispatcher.dispatch({
        userId,
        kind: 'weekly_adherence',
        data: {
          title: '📊 Relatório Semanal de Adesão',
          body: `Sua taxa de adesão na última semana foi de ${percentage}% (${takenDoses}/${expectedDoses} doses).`,
          summary: `Última semana: ${percentage}%`,
          percentage,
          takenDoses,
          expectedDoses
        },
        context: { correlationId, jobType: 'weekly_adherence_report' }
      });
    }
  } catch (err) {
    logger.error('Erro em checkAdherenceReportsViaDispatcher', err, { correlationId });
  }
}

/**
 * Check titration alerts for ALL users via Dispatcher
 */
export async function checkTitrationAlertsViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    logger.info(`Iniciando alertas de titulação via Dispatcher para ${users.length} usuários`, { correlationId });

    for (const user of users) {
      const userId = user.user_id;
      
      const { data: protocols } = await supabase
        .from('protocols')
        .select(`
          *,
          medicine:medicines(name, dosage_unit)
        `)
        .eq('user_id', userId)
        .in('titration_status', ['titulando', 'alvo_atingido']);

      if (!protocols || protocols.length === 0) continue;

      for (const protocol of protocols) {
        const message = formatTitrationAlertMessage(protocol);
        
        await dispatcher.dispatch({
          userId,
          kind: 'titration_alert',
          data: {
            title: '📈 Ajuste de Dose (Titulação)',
            body: message,
            message,
            protocolId: protocol.id,
            medicineName: protocol.medicine?.name,
            titrationStatus: protocol.titration_status
          },
          context: { correlationId, protocolId: protocol.id, jobType: 'titration_alert' }
        });
      }
    }
  } catch (err) {
    logger.error('Erro em checkTitrationAlertsViaDispatcher', err, { correlationId });
  }
}

/**
 * Check monthly reports for ALL users via Dispatcher
 */
export async function checkMonthlyReportViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    logger.info(`Iniciando relatórios mensais via Dispatcher para ${users.length} usuários`, { correlationId });

    for (const user of users) {
      const userId = user.user_id;

      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: logs } = await supabase
        .from('medicine_logs')
        .select('id')
        .eq('user_id', userId)
        .gte('taken_at', oneMonthAgo);

      const protocols = await getActiveProtocols(userId, true);
      const expectedDoses = protocols.reduce((sum, p) => {
        const intakesPerDay = (p.time_schedule || []).length;
        return sum + (intakesPerDay * 30);
      }, 0);
      
      const takenDoses = logs?.length || 0;
      const percentage = expectedDoses > 0 ? Math.round((takenDoses / expectedDoses) * 100) : 0;

      await dispatcher.dispatch({
        userId,
        kind: 'monthly_report',
        data: {
          title: '🗓️ Relatório Mensal',
          body: `Sua taxa de adesão no último mês foi de ${percentage}% (${takenDoses}/${expectedDoses} doses).`,
          summary: `Último mês: ${percentage}%`,
          percentage,
          takenDoses,
          expectedDoses
        },
        context: { correlationId, jobType: 'monthly_report' }
      });
    }
  } catch (err) {
    logger.error('Erro em checkMonthlyReportViaDispatcher', err, { correlationId });
  }
}

/**
 * Check prescription alerts for ALL users via Dispatcher
 */
export async function checkPrescriptionAlertsViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone')
      .eq('notifications_enabled', true);

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    logger.info(`Iniciando alertas de prescrição via Dispatcher para ${users.length} usuários`, { correlationId });

    for (const user of users) {
      const userId = user.user_id;
      const timezone = user.timezone || 'America/Sao_Paulo';
      const today = getCurrentDateInTimezone(timezone);
      const todayDate = new Date(today + 'T00:00:00');

      const { data: protocols } = await supabase
        .from('protocols')
        .select(`
          *,
          medicine:medicines(name, dosage_unit)
        `)
        .eq('user_id', userId)
        .eq('active', true)
        .not('end_date', 'is', null);

      if (!protocols || protocols.length === 0) continue;

      for (const protocol of protocols) {
        const endDate = new Date(protocol.end_date + 'T00:00:00');
        const diffTime = endDate.getTime() - todayDate.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const alertDays = [30, 7, 1];
        if (!alertDays.includes(daysRemaining)) continue;

        const message = formatPrescriptionAlertMessage(protocol, daysRemaining);

        await dispatcher.dispatch({
          userId,
          kind: 'prescription_alert',
          data: {
            title: '📋 Alerta de Prescrição',
            body: message,
            protocolId: protocol.id,
            medicineName: protocol.medicine?.name,
            daysRemaining
          },
          context: { correlationId, protocolId: protocol.id, jobType: 'prescription_alert' }
        });
      }
    }
  } catch (err) {
    logger.error('Erro em checkPrescriptionAlertsViaDispatcher', err, { correlationId });
  }
}


/**
 * Check stock alerts for a specific user
 */
export async function checkStockAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkStockAlerts. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando alertas de estoque via Dispatcher (ADR-030)', { correlationId });
  return checkStockAlertsViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check adherence reports for ALL users (weekly)
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkAdherenceReports(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkAdherenceReports. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando relatórios de adesão via Dispatcher (ADR-030)', { correlationId });
  return checkAdherenceReportsViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check titration alerts for a specific user
 */

/**
 * Check titration alerts for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkTitrationAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkTitrationAlerts. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando alertas de titulação via Dispatcher (ADR-030)', { correlationId });
  return checkTitrationAlertsViaDispatcher(notificationDispatcher, correlationId);
}

/**
 * Check monthly reports for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkMonthlyReport(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkMonthlyReport. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando relatórios mensais via Dispatcher (ADR-030)', { correlationId });
  return checkMonthlyReportViaDispatcher(notificationDispatcher, correlationId);
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
 * Check prescription alerts for ALL users
 * @param {object} bot - Bot adapter
 * @param {object} options - Opções adicionais (correlationId, etc)
 */
export async function checkPrescriptionAlerts(bot, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const notificationDispatcher = options.notificationDispatcher;

  if (!notificationDispatcher) {
    logger.warn('NotificationDispatcher não fornecido para checkPrescriptionAlerts. Skipping.', { correlationId });
    return;
  }

  logger.info('Iniciando alertas de prescrição via Dispatcher (ADR-030)', { correlationId });
  return checkPrescriptionAlertsViaDispatcher(notificationDispatcher, correlationId);
}