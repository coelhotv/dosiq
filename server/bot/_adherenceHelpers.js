import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { shouldSendNotification } from '../services/notificationDeduplicator.js';
import { getCurrentTimeInTimezone, getTodayLocal, parseLocalDate, addDays, getNow } from '../utils/dateUtils.js';
import { getActiveProtocols } from '../services/protocolCache.js';

const logger = createLogger('AdherenceHelpers');
const ADHERENCE_REPORT_TIME = '23:00';

async function _getEligibleUsersForAdherence(users, correlationId) {
  const eligibleUsers = [];
  for (const user of users) {
    try {
      const timezone = user.timezone || 'America/Sao_Paulo';
      const currentHHMM = getCurrentTimeInTimezone(timezone).substring(0, 5);
      
      // Relatório de adesão é fixo às 23:00 (ADHERENCE_REPORT_TIME)
      if (currentHHMM !== ADHERENCE_REPORT_TIME) continue;

      const shouldSend = await shouldSendNotification(user.user_id, null, 'adherence_report');
      if (!shouldSend) continue;

      eligibleUsers.push(user);
    } catch (err) {
      logger.error(`Error evaluating adherence report eligibility for user`, err, { userId: user.user_id, correlationId });
    }
  }
  return eligibleUsers;
}

function _getAdherenceStorytelling(percentage, percentageYesterday, expectedDoses) {
  if (percentage > percentageYesterday) {
    return `📈 Melhora de ${percentage - percentageYesterday}% em relação a ontem!`;
  } else if (percentage < percentageYesterday && percentage > 0) {
    return `📉 Hoje foi um pouco mais difícil que ontem (${percentage}% vs ${percentageYesterday}%).`;
  } else if (percentage === 100 && percentageYesterday === 100) {
    return `🌟 Segundo dia seguido com 100%!`;
  } else if (percentage === 0 && expectedDoses > 0) {
    return `🧘 Amanhã é uma nova oportunidade para cuidar de você.`;
  } else {
    return `⚖️ Mantendo a constância de ontem.`;
  }
}

async function _processUserAdherence(user, protocolsByUser, dispatcher, correlationId) {
  const { user_id: userId, display_name: displayName } = user;
  try {
    const dateToday = getTodayLocal();
    const startOfDay = parseLocalDate(dateToday);
    const dateYesterdayDate = addDays(startOfDay, -1);
    const startOfYesterday = getTodayLocal(dateYesterdayDate);
    
    const { data: logs } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('taken_at', dateYesterdayDate.toISOString());

    const todayLogs = logs?.filter(l => l.taken_at >= startOfDay.toISOString()) || [];
    const yesterdayLogs = logs?.filter(l => l.taken_at < startOfDay.toISOString() && l.taken_at >= dateYesterdayDate.toISOString()) || [];

    const protocols = protocolsByUser[userId] || [];
    if (protocols.length === 0) return;

    const expectedDoses = protocols.reduce((sum, p) => sum + (p.time_schedule?.length || 0), 0);
    const takenDoses = todayLogs.length;
    const percentage = expectedDoses > 0 ? Math.min(100, Math.round((takenDoses / expectedDoses) * 100)) : 0;
    
    const expectedYesterday = protocols.reduce((sum, p) => {
      if (p.start_date && p.start_date > startOfYesterday) return sum;
      return sum + (p.time_schedule?.length || 0);
    }, 0);
    const percentageYesterday = expectedYesterday > 0 ? Math.min(100, Math.round((yesterdayLogs.length / expectedYesterday) * 100)) : 0;
    
    const storytelling = _getAdherenceStorytelling(percentage, percentageYesterday, expectedDoses);

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

/**
 * Relatório Diário de Adesão (Fase 12)
 * Disparado às 23:00 para todos os usuários (estratégia Inbox-First).
 * Foca em analytics e reforço positivo.
 */
export async function runDailyAdherenceReportViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users } = await supabase
      .from('user_settings')
      .select('user_id, timezone, display_name, digest_time, notification_mode')
      .neq('notification_mode', 'silent');

    if (!users || users.length === 0) return;

    const eligibleUsers = await _getEligibleUsersForAdherence(users, correlationId);

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
      await _processUserAdherence(user, protocolsByUser, dispatcher, correlationId);
    }
  } catch (error) {
    logger.error('Error in runDailyAdherenceReportViaDispatcher', error, { correlationId });
  }
}

/**
 * Check adherence reports for ALL users (weekly) via Dispatcher
 */
export async function checkAdherenceReportsViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode, display_name');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    // WAVE 11: Respeitar o modo de notificação (Silent = nada)
    const eligibleUsers = users.filter(u => u.notification_mode !== 'silent');
    if (eligibleUsers.length === 0) return;

    logger.info(`Iniciando relatórios semanais via Dispatcher para ${eligibleUsers.length} usuários elegíveis`, { correlationId });

    for (const user of eligibleUsers) {
      const userId = user.user_id;
      
      // Cálculo de adesão (últimos 7 dias)
      const oneWeekAgo = addDays(getNow(), -7).toISOString();
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
 * Check monthly reports for ALL users via Dispatcher
 */
export async function checkMonthlyReportViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, display_name');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    logger.info(`Iniciando relatórios mensais via Dispatcher para ${users.length} usuários`, { correlationId });

    for (const user of users) {
      const userId = user.user_id;

      const oneMonthAgo = addDays(getNow(), -30).toISOString();
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
