import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { shouldSendNotification } from '../../services/notificationDeduplicator.js';
import { getCurrentTimeInTimezone, getTodayLocal, getCurrentDatePartsInTimezone } from '../../utils/dateUtils.js';
import { isProtocolActiveOnWeekday } from '../../utils/protocolActiveHelper.js';

const logger = createLogger('DailyDigest');

async function _getEligibleUsersForDigest(users, correlationId) {
  const eligibleEntries = [];
  for (const user of users) {
    const userId = user.user_id;
    try {
      const timezone = user.timezone || 'America/Sao_Paulo';
      const digestTime = (user.digest_time || '07:00').slice(0, 5);
      const currentHHMM = getCurrentTimeInTimezone(timezone);

      logger.debug(`Evaluating user ${userId} (${user.display_name})`, { 
        timezone, digestTime, currentHHMM, match: currentHHMM === digestTime, correlationId 
      });

      if (currentHHMM !== digestTime) continue;

      const shouldSend = await shouldSendNotification(userId, null, 'daily_digest');
      if (!shouldSend) {
        logger.debug(`Daily digest suppressed by deduplication`, { userId, correlationId });
        continue;
      }

      eligibleEntries.push({ userId, timezone, displayName: user.display_name, digestTime });
    } catch (err) {
      logger.error(`Error evaluating daily digest eligibility for user`, err, { userId, correlationId });
    }
  }
  return eligibleEntries;
}

// 043 T023b — monta o payload do digest a partir dos protocolos do dia. Função ÚNICA de
// conteúdo: o caminho legado e o builder da outbox chamam ESTA — sem ela, o cutover
// manteria duas implementações do mesmo texto, que divergem em silêncio.
function _buildDigestPayload({ protocols, displayName, digestTime, timezone }) {
  const { weekday } = getCurrentDatePartsInTimezone(timezone);
  const todayStr = getTodayLocal();

  const todaySchedule = [];
  (protocols || []).forEach(p => {
    if (!isProtocolActiveOnWeekday(p, weekday, todayStr)) return;

    (p.time_schedule || []).forEach(time => {
      todaySchedule.push({
        time,
        medicineName: p.medicine?.name || p.name,
        dosagePerIntake: p.dosage_per_intake || 1,
        dosageUnit: p.medicine?.dosage_unit,
        // 012 Fase D (FR-015b / R-267): frase de dose líquida no digest.
        dosagePerPill: p.medicine?.dosage_per_pill ?? null,
        unitsPerMl: p.medicine?.units_per_ml ?? null,
        intakeUnit: p.intake_unit ?? null
      });
    });
  });
  todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

  return {
    firstName: displayName || 'Paciente',
    hour: parseInt(String(digestTime).split(':')[0], 10),
    pendingCount: todaySchedule.length,
    medicines: todaySchedule.map(s => ({
      name: s.medicineName,
      time: s.time,
      dosagePerIntake: s.dosagePerIntake,
      dosageUnit: s.dosageUnit,
      dosagePerPill: s.dosagePerPill,
      unitsPerMl: s.unitsPerMl,
      intakeUnit: s.intakeUnit
    }))
  };
}

// Protocolos ativos hoje de UM usuário (o caminho legado busca em lote p/ N usuários; o drain
// da outbox chega com 1 usuário por linha).
async function _fetchActiveProtocolsForUser(userId: string) {
  const today = getTodayLocal();
  const { data, error } = await supabase
    .from('protocols')
    .select('*, medicine:medicines(name, dosage_unit, dosage_per_pill, units_per_ml)')
    .eq('user_id', userId)
    .eq('active', true)
    .lte('start_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`);
  if (error) throw new Error(`_fetchActiveProtocolsForUser: ${error.message}`);
  return data ?? [];
}

/**
 * 043 T023b — content builder do `daily_digest` para a outbox (ADR-078).
 *
 * Conteúdo construído NO ENVIO a partir de dados FRESCOS (SEC-1: a fila guarda só referências).
 * Revalida a elegibilidade no momento do disparo: entre o enqueue e o drain o usuário pode ter
 * saído do modo `digest_morning` — nesse caso retorna null e a linha é marcada sem envio.
 */
export async function buildDailyDigestData(userId: string, settings?: Record<string, any>) {
  // Revalida contra o DB (o settings do drain traz só o básico e pode estar defasado).
  const { data: row, error } = await supabase
    .from('user_settings')
    .select('notification_mode, digest_time, timezone, display_name')
    .eq('user_id', userId)
    .single();

  // Erro de infra NÃO pode virar "deixou de ser elegível" (review #742): com o error ignorado,
  // uma falha momentânea do DB devolvia row=undefined → null → o drain marcava a linha como
  // "sem conteúdo" e o digest do dia era descartado em silêncio, sem retry. Lançar deixa a
  // linha na fila p/ o próximo tick. PGRST116 (nenhuma linha) é ausência de verdade, não falha.
  if (error && error.code !== 'PGRST116') {
    throw new Error(`buildDailyDigestData: ${error.message}`);
  }

  const mode = row?.notification_mode;
  if (mode !== 'digest_morning') return null; // deixou de ser elegível → nada a enviar

  const timezone = row?.timezone || settings?.timezone || 'America/Sao_Paulo';
  const digestTime = (row?.digest_time || '07:00').slice(0, 5);
  const displayName = row?.display_name ?? settings?.display_name;

  const protocols = await _fetchActiveProtocolsForUser(userId);
  return _buildDigestPayload({ protocols, displayName, digestTime, timezone });
}

/**
 * Run daily digest via dispatcher (Sprint 6.4 — ADR-029, ADR-030)
 */
export async function runDailyDigestViaDispatcher(dispatcher, correlationId) {
  try {
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

    const eligibleEntries = await _getEligibleUsersForDigest(users, correlationId);

    if (eligibleEntries.length === 0) {
      logger.info('Daily digest: no eligible users at this time', { correlationId });
      return;
    }

    const eligibleIds = eligibleEntries.map(e => e.userId);
    const today = getTodayLocal();
    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('*, medicine:medicines(name, dosage_unit, dosage_per_pill, units_per_ml)')
      .in('user_id', eligibleIds)
      .eq('active', true)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`);

    const protocolsByUser = {};
    for (const p of allProtocols ?? []) {
      if (!protocolsByUser[p.user_id]) protocolsByUser[p.user_id] = [];
      protocolsByUser[p.user_id].push(p);
    }

    for (const { userId, displayName, digestTime, timezone } of eligibleEntries) {
      try {
        // Mesmo payload builder do caminho da outbox (T023b) — uma implementação só.
        const data = _buildDigestPayload({
          protocols: protocolsByUser[userId] || [],
          displayName,
          digestTime,
          timezone,
        });

        await dispatcher.dispatch({
          userId, kind: 'daily_digest', data, context: { correlationId, jobType: 'daily_digest' }
        });

      } catch (err) {
        logger.error(`Error processing daily digest for user`, err, { userId, correlationId });
      }
    }
  } catch (error) {
    logger.error('Error in runDailyDigestViaDispatcher', error, { correlationId });
  }
}
