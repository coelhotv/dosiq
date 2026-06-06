import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { shouldSendNotification } from '../services/notificationDeduplicator.js';
import { getCurrentTimeInTimezone, getCurrentDatePartsInTimezone, getTodayLocal, parseLocalDate, addDays, getServerTimestamp } from '../utils/dateUtils.js';
import { createDoseInstanceRepository } from '@dosiq/core';
import { sweepMissedInstances } from './doseInstanceScheduler.js';

const logger = createLogger('AdherenceHelpers');
const ADHERENCE_REPORT_TIME = '09:00';

// Adesão do bot ← dose_instances (S3.7/ADR-054): % = taken/(taken+missed), skipped_* neutro.
// countByStatus é head-count server-side (R-249 OOM-safe, imune a truncamento PostgREST AP-186).
const doseInstanceRepo = createDoseInstanceRepository({ client: supabase });

// % de adesão a partir das contagens por status (clamp 0-100, AP-191). denom vazio → 0.
function _adherencePct(taken, missed) {
  const denom = taken + missed;
  return denom > 0 ? Math.min(100, Math.round((taken / denom) * 100)) : 0;
}

// Janela rolante de N dias em UTC REAL. NÃO usar getNow()/getSaoPauloTime aqui: ele desloca
// o instante pro wall-clock de SP, e .toISOString() sairia 3h atrás do UTC de `scheduled_for`
// (omitiria as doses das últimas 3h). getServerTimestamp() = UTC real; 1 chamada (instante único).
function _utcWindow(days) {
  const nowIso = getServerTimestamp();
  return { fromTs: addDays(nowIso, -days).toISOString(), toTs: nowIso };
}

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

// _getAdherenceStorytelling removed — moved to Layer 2 (buildNotificationPayload.js)

async function _processUserAdherence(user, dispatcher, correlationId) {
  const { user_id: userId, display_name: displayName } = user;
  try {
    // Filtro 1: Apenas usuários com tratamentos ativos no banco
    const { data: activeProtocols, error: protocolsError } = await supabase
      .from('protocols')
      .select('id')
      .eq('user_id', userId)
      .eq('active', true)
      .limit(1);

    if (protocolsError || !activeProtocols || activeProtocols.length === 0) {
      logger.debug(`Usuário sem tratamentos ativos. Pulando relatório diário.`, { userId });
      return;
    }

    const dateToday = getTodayLocal();
    const startOfDay = parseLocalDate(dateToday);
    
    // Período de Ontem (análise principal): D-1 00:00:00 até D-1 23:59:59.999
    const dateYesterdayDate = addDays(startOfDay, -1);
    // eslint-disable-next-line no-restricted-syntax
    const yesterdayEndExclusive = new Date(startOfDay.getTime() - 1).toISOString();
    const yesterdayCounts = await doseInstanceRepo.countByStatus({
      userId, fromTs: dateYesterdayDate.toISOString(), toTs: yesterdayEndExclusive,
    });

    const totalYesterday = yesterdayCounts.taken + yesterdayCounts.missed;

    // Filtro 2: Apenas usuários com pelo menos 1 dose esperada no período analisado
    if (totalYesterday === 0) {
      logger.debug(`Usuário sem doses esperadas ontem. Pulando relatório diário.`, { userId });
      return;
    }

    // Período de Anteontem (para comparação): D-2 00:00:00 até D-2 23:59:59.999
    const dateBeforeYesterdayDate = addDays(startOfDay, -2);
    // eslint-disable-next-line no-restricted-syntax
    const beforeYesterdayEndExclusive = new Date(dateYesterdayDate.getTime() - 1).toISOString();
    const beforeYesterdayCounts = await doseInstanceRepo.countByStatus({
      userId, fromTs: dateBeforeYesterdayDate.toISOString(), toTs: beforeYesterdayEndExclusive,
    });

    const takenDoses = yesterdayCounts.taken;
    const percentage = _adherencePct(yesterdayCounts.taken, yesterdayCounts.missed);
    const percentageBeforeYesterday = _adherencePct(beforeYesterdayCounts.taken, beforeYesterdayCounts.missed);
    const hasBeforeYesterday = (beforeYesterdayCounts.taken + beforeYesterdayCounts.missed) > 0;

    const delta = percentage - percentageBeforeYesterday;
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const comparison = hasBeforeYesterday
      ? { previousPercentage: percentageBeforeYesterday, deltaPercent: Math.abs(delta), trend }
      : undefined;

    const data = {
      firstName: displayName || 'Paciente',
      period: 'ontem',
      percentage,
      taken: takenDoses,
      total: totalYesterday,
      comparison
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
      .select('user_id, timezone, display_name, digest_time, notification_mode');

    if (!users || users.length === 0) return;

    const eligibleUsers = await _getEligibleUsersForAdherence(users, correlationId);

    if (eligibleUsers.length === 0) return;

    logger.info(`Running daily adherence report for ${eligibleUsers.length} users`, { correlationId });

    // E2/S3.7: fechar as pending vencidas ANTES de medir — o relatório das 9h lê as doses
    // de ontem, mas o sweep prévio garante consistência. Idempotente (writer #3, AP-190).
    try {
      await sweepMissedInstances();
    } catch (sweepErr) {
      logger.error('Falha no sweep pré-relatório 9h (segue best-effort)', sweepErr, { correlationId });
    }

    for (const user of eligibleUsers) {
      await _processUserAdherence(user, dispatcher, correlationId);
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
    const { data: eligibleUsers, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode, display_name');

    if (userError) throw userError;
    if (!eligibleUsers || eligibleUsers.length === 0) return;

    logger.info(`Iniciando relatórios semanais via Dispatcher para ${eligibleUsers.length} usuários`, { correlationId });

    for (const user of eligibleUsers) {
      const userId = user.user_id;

      const timezone = user.timezone || 'America/Sao_Paulo';
      const { hhmm, weekday } = getCurrentDatePartsInTimezone(timezone);
      if (weekday !== 0 || hhmm !== '09:00') continue;

      // Filtro 1: Apenas usuários com tratamentos ativos no banco
      const { data: activeProtocols, error: protocolsError } = await supabase
        .from('protocols')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)
        .limit(1);
      if (protocolsError || !activeProtocols || activeProtocols.length === 0) continue;

      const shouldSend = await shouldSendNotification(userId, null, 'weekly_adherence');
      if (!shouldSend) continue;

      // Adesão dos últimos 7 dias ← dose_instances (head-count server-side, janela UTC real).
      const counts = await doseInstanceRepo.countByStatus({ userId, ..._utcWindow(7) });
      const total = counts.taken + counts.missed;

      // Filtro 2: Apenas usuários com pelo menos 1 dose esperada na janela
      if (total === 0) continue;

      const takenDoses = counts.taken;
      const percentage = _adherencePct(counts.taken, counts.missed);

      await dispatcher.dispatch({
        userId,
        kind: 'weekly_adherence',
        data: {
          firstName: user.display_name || 'Paciente',
          percentage,
          taken: takenDoses,
          total
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
    const { data: eligibleUsers, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode, display_name');

    if (userError) throw userError;
    if (!eligibleUsers || eligibleUsers.length === 0) return;

    logger.info(`Iniciando relatórios mensais via Dispatcher para ${eligibleUsers.length} usuários`, { correlationId });

    for (const user of eligibleUsers) {
      const userId = user.user_id;

      const timezone = user.timezone || 'America/Sao_Paulo';
      const { hhmm, dayOfMonth } = getCurrentDatePartsInTimezone(timezone);
      if (dayOfMonth !== 1 || hhmm !== '09:00') continue;

      // Filtro 1: Apenas usuários com tratamentos ativos no banco
      const { data: activeProtocols, error: protocolsError } = await supabase
        .from('protocols')
        .select('id')
        .eq('user_id', userId)
        .eq('active', true)
        .limit(1);
      if (protocolsError || !activeProtocols || activeProtocols.length === 0) continue;

      const shouldSend = await shouldSendNotification(userId, null, 'monthly_report');
      if (!shouldSend) continue;

      // Adesão dos últimos 30 dias ← dose_instances (head-count server-side, R-249, janela UTC real).
      const counts = await doseInstanceRepo.countByStatus({ userId, ..._utcWindow(30) });
      const total = counts.taken + counts.missed;

      // Filtro 2: Apenas usuários com pelo menos 1 dose esperada na janela
      if (total === 0) continue;

      const takenDoses = counts.taken;
      const percentage = _adherencePct(counts.taken, counts.missed);

      await dispatcher.dispatch({
        userId,
        kind: 'monthly_report',
        data: {
          firstName: user.display_name || 'Paciente',
          percentage,
          taken: takenDoses,
          total
        },
        context: { correlationId, jobType: 'monthly_report' }
      });
    }
  } catch (err) {
    logger.error('Erro em checkMonthlyReportViaDispatcher', err, { correlationId });
  }
}
