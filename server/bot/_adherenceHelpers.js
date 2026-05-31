import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { shouldSendNotification } from '../services/notificationDeduplicator.js';
import { getCurrentTimeInTimezone, getCurrentDatePartsInTimezone, getTodayLocal, parseLocalDate, addDays, getServerTimestamp } from '../utils/dateUtils.js';
import { createDoseInstanceRepository } from '@dosiq/core';
import { sweepMissedInstances } from './doseInstanceScheduler.js';

const logger = createLogger('AdherenceHelpers');
const ADHERENCE_REPORT_TIME = '23:00';

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
    const dateToday = getTodayLocal();
    const startOfDay = parseLocalDate(dateToday);
    const dateYesterdayDate = addDays(startOfDay, -1);

    // Adesão de hoje e ontem ← dose_instances por status (head-count server-side).
    // Janela por scheduled_for; o sweep das 23h (runDaily) já fechou as pending vencidas.
    // countByStatus usa limites inclusivos (gte/lte) → o teto de ontem deve excluir o
    // exato startOfDay (senão uma instância às 00:00 conta nos dois dias — double-count).
    // Nota G1 (ADR-053): startOfDay vem de parseLocalDate (meia-noite no tz do servidor),
    // não da meia-noite real de SP — alinhamento fino de tz fica para a F4.
    const todayCounts = await doseInstanceRepo.countByStatus({
      userId, fromTs: startOfDay.toISOString(), toTs: addDays(startOfDay, 1).toISOString(),
    });
    // Teto exclusivo de ontem (ms-1): aritmética de epoch, não o parse de string YYYY-MM-DD do R-020.
    // eslint-disable-next-line no-restricted-syntax
    const yesterdayEndExclusive = new Date(startOfDay.getTime() - 1).toISOString();
    const yesterdayCounts = await doseInstanceRepo.countByStatus({
      userId, fromTs: dateYesterdayDate.toISOString(), toTs: yesterdayEndExclusive,
    });

    const takenDoses = todayCounts.taken;
    const totalToday = todayCounts.taken + todayCounts.missed;
    const percentage = _adherencePct(todayCounts.taken, todayCounts.missed);
    const percentageYesterday = _adherencePct(yesterdayCounts.taken, yesterdayCounts.missed);
    const hasYesterday = (yesterdayCounts.taken + yesterdayCounts.missed) > 0;

    const delta = percentage - percentageYesterday;
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const comparison = hasYesterday
      ? { previousPercentage: percentageYesterday, deltaPercent: Math.abs(delta), trend }
      : undefined;

    const data = {
      firstName: displayName || 'Paciente',
      period: 'hoje',
      percentage,
      taken: takenDoses,
      total: totalToday,
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

    // E2/S3.7: fechar as pending vencidas ANTES de medir — o relatório das 23h lê o dia
    // corrente antes do sweep das 3AM; sem isto doses esquecidas seguem pending e inflam a
    // adesão. Idempotente (writer #3, AP-190). Global, mas roda 1× quando alguém bate 23h.
    try {
      await sweepMissedInstances();
    } catch (sweepErr) {
      logger.error('Falha no sweep pré-relatório 23h (segue best-effort)', sweepErr, { correlationId });
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
      if (weekday !== 0 || hhmm !== '23:00') continue;

      const shouldSend = await shouldSendNotification(userId, null, 'weekly_adherence');
      if (!shouldSend) continue;

      // Adesão dos últimos 7 dias ← dose_instances (head-count server-side, janela UTC real).
      const counts = await doseInstanceRepo.countByStatus({ userId, ..._utcWindow(7) });
      const takenDoses = counts.taken;
      const total = counts.taken + counts.missed;
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
      if (dayOfMonth !== 1 || hhmm !== '10:00') continue;

      const shouldSend = await shouldSendNotification(userId, null, 'monthly_report');
      if (!shouldSend) continue;

      // Adesão dos últimos 30 dias ← dose_instances (head-count server-side, R-249, janela UTC real).
      const counts = await doseInstanceRepo.countByStatus({ userId, ..._utcWindow(30) });
      const takenDoses = counts.taken;
      const total = counts.taken + counts.missed;
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
