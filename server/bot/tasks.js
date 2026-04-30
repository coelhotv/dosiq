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
import { partitionDoses } from './utils/partitionDoses.js';
import { parseLocalDate, formatLocalDate } from '../utils/dateUtils.js';
import { 
  formatMedicineWithStrength, 
  formatIntakeQuantity 
} from './utils/notificationHelpers.js';


const logger = createLogger('Tasks');

// Horário fixo para o relatório diário de adesão (fechamento do dia)
const ADHERENCE_REPORT_TIME = '23:00';

// Helpers removidos (migrados para ./utils/notificationHelpers.js)

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
            medicine:medicines(name, dosage_unit, dosage_per_pill),
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
            medicineName: formatMedicineWithStrength(
              p.medicine?.name || p.name, 
              p.medicine?.dosage_per_pill, 
              p.medicine?.dosage_unit
            ),
            treatmentPlanId: p.treatment_plan_id ?? null,
            treatmentPlanName: p.treatment_plan?.name ?? null,
            dosagePerIntake: p.dosage_per_intake ?? 1,
            dosageString: formatIntakeQuantity(p.dosage_per_intake || 1, p.medicine?.dosage_unit),
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
              time: currentHHMM,
              dosage: dose.dosageString || dose.dosagePerIntake,
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
      .select('*, medicine:medicines(name, dosage_unit, dosage_per_pill)')
      .in('user_id', eligibleIds)
      .eq('active', true);

    const protocolsByUser = {};
    for (const p of allProtocols ?? []) {
      if (!protocolsByUser[p.user_id]) protocolsByUser[p.user_id] = [];
      protocolsByUser[p.user_id].push(p);
    }

    // Fase 3: dispatch por usuário com dados já em memória
    for (const { userId, displayName, digestTime } of eligibleEntries) {
      try {
        const protocols = protocolsByUser[userId] || [];


        // Agenda de Hoje
        const todaySchedule = [];
        protocols.forEach(p => {
          (p.time_schedule || []).forEach(time => {
            todaySchedule.push({
              time,
              medicineName: formatMedicineWithStrength(
                p.medicine?.name || p.name,
                p.medicine?.dosage_per_pill,
                p.medicine?.dosage_unit
              ),
              dosageString: formatIntakeQuantity(p.dosage_per_intake || 1, p.medicine?.dosage_unit)
            });
          });
        });
        todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

        const currentHour = parseInt(digestTime.split(':')[0], 10);
        
        // Dados para a Presentation Layer (L2) - Gate L1 -> L2
        const data = {
          firstName: displayName || 'Paciente',
          hour: currentHour,
          pendingCount: todaySchedule.length,
          medicines: todaySchedule.map(s => ({
            name: s.medicineName,
            time: s.time,
            dosage: s.dosageString
          }))
        };

        await dispatcher.dispatch({
          userId,
          kind: 'daily_digest',
          data,
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
        const currentHHMM = getCurrentTimeInTimezone(timezone).replace(/[^\d:]/g, ''); 
        
        // Relatório de adesão é fixo às 23:00 (ADHERENCE_REPORT_TIME)
        // Desacoplado do digest_time (que é matinal)
        if (currentHHMM !== ADHERENCE_REPORT_TIME) continue;

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
          storytelling = `📈 Melhora de ${percentage - percentageYesterday}% em relação a ontem!`;
        } else if (percentage < percentageYesterday && percentage > 0) {
          storytelling = `📉 Hoje foi um pouco mais difícil que ontem (${percentage}% vs ${percentageYesterday}%).`;
        } else if (percentage === 100 && percentageYesterday === 100) {
          storytelling = `🌟 Segundo dia seguido com 100%!`;
        } else if (percentage === 0 && expectedDoses > 0) {
          storytelling = `🧘 Amanhã é uma nova oportunidade para cuidar de você.`;
        } else {
          storytelling = `⚖️ Mantendo a constância de ontem.`;
        }

        // Dados para a Presentation Layer (L2) - Gate L1 -> L2
        const data = {
          firstName: displayName || 'Paciente',
          period: 'hoje',
          percentage,
          taken: takenDoses,
          total: expectedDoses,
          storytelling
        };

        await dispatcher.dispatch({
          userId,
          kind: 'adherence_report',
          data,
          context: { correlationId, jobType: 'adherence_report' }
        });

      } catch (err) {
        logger.error(`Error processing daily adherence for user`, err, { userId, correlationId });
      }
    }
  } catch (error) {
    logger.error('Error in runDailyAdherenceReportViaDispatcher', error, { correlationId });
  }
}

/**
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

        // Dados para a Presentation Layer (L2) - Gate L1 -> L2
        const data = {
          medicineName: stock.name,
          remaining: stock.qty,
          daysRemaining
        };

        await dispatcher.dispatch({
          userId,
          kind: 'stock_alert',
          data,
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
      const percentage = expectedDoses > 0 ? Math.min(100, Math.round((takenDoses / expectedDoses) * 100)) : 0;

      await dispatcher.dispatch({
        userId,
        kind: 'adherence_report',
        data: {
          firstName: user.display_name || 'Paciente',
          period: 'na última semana',
          percentage,
          taken: takenDoses,
          total: expectedDoses
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
          id, current_stage_index, titration_schedule, titration_status,
          medicine:medicine_id (name, dosage_unit)
        `)
        .eq('user_id', userId)
        .eq('status', 'ativo')
        .not('titration_schedule', 'is', null);

      if (!protocols || protocols.length === 0) continue;

      for (const protocol of protocols) {
        const medicine = protocol.medicine || {};
        const currentStage = (protocol.current_stage_index || 0) + 1;
        const totalStages = protocol.titration_schedule?.length || 0;
        const nextStageData = protocol.titration_schedule?.[protocol.current_stage_index + 1];

        // Dados para a Presentation Layer (L2) - Gate L1 -> L2
        const data = {
          medicineName: medicine.name || 'Medicamento',
          currentStage,
          totalStages,
          status: protocol.titration_status === 'alvo_atingido' ? 'alvo_atingido' : 'titulando',
          nextStage: nextStageData ? {
            dosage: nextStageData.dosage,
            unit: medicine.dosage_unit || 'mg',
            date: nextStageData.date
          } : undefined
        };

        await dispatcher.dispatch({
          userId,
          kind: 'titration_alert',
          data,
          context: { correlationId, jobType: 'titration_alert' }
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
          firstName: user.display_name || 'Paciente',
          percentage,
          taken: takenDoses,
          total: expectedDoses
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

        await dispatcher.dispatch({
          userId,
          kind: 'prescription_alert',
          data: {
            medicineName: protocol.medicine?.name || 'Medicamento',
            endDate: protocol.end_date,
            daysRemaining
          },
          context: { correlationId, jobType: 'prescription_alert' }
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
 * Envia digest diário de notificações falhadas para o admin via Dispatcher (ADR-030)
 * @param {object} notificationDispatcher - Dispatcher central
 * @param {object} options - Opções com correlationId
 * @returns {Promise<object>} Resultado da operação
 */
export async function sendDLQDigest(notificationDispatcher, options = {}) {
  const correlationId = options.correlationId || getCurrentCorrelationId();
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
  
  try {
    // Buscar notificações falhadas pendentes (inclui retrying)
    const { data: failedNotifications, error } = await supabase
      .from('failed_notification_queue')
      .select('id, notification_type, error_message, created_at')
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
    
    // Disparar via Dispatcher (Layer 1 -> Layer 2 -> Layer 3)
    const result = await notificationDispatcher.dispatch({
      userId: SYSTEM_USER_ID,
      kind: 'dlq_digest',
      data: {
        failedCount: failedNotifications.length,
        failures: failedNotifications.map(f => ({
          id: f.id,
          type: f.notification_type,
          error_message: f.error_message,
          created_at: f.created_at
        }))
      },
      context: { correlationId }
    });
    
    return { 
      sent: result.success, 
      count: failedNotifications.length,
      success: result.success 
    };
    
  } catch (err) {
    logger.error('Error in sendDLQDigest', err, { correlationId });
    return { sent: false, reason: 'exception', error: err.message };
  }
}

// --- Prescription Alert Functions (F5.9) ---



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