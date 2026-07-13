import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { shouldSendNotification, shouldSendGroupedNotification } from '../services/notificationDeduplicator.js';
import { getCurrentTime, getCurrentTimeInTimezone, parseLocalDate, getTodayLocal, getCurrentDatePartsInTimezone, getServerTimestamp, parseISO, parseTimestamp, addMinutes } from '../utils/dateUtils.js';
import { partitionDoses } from './utils/partitionDoses.js';
import { isProtocolActiveOnWeekday } from '../utils/protocolActiveHelper.js';
import { calculateDailyIntake, calculateDaysRemaining, isLiquidMedicine, doseToMl, cleanFloat } from '@dosiq/core';
import { dispatchLiveActivityStarts } from '../notifications/apns/dispatchLiveActivityStarts.js';
import { dispatchLiveActivityLifecycle } from '../notifications/apns/dispatchLiveActivityLifecycle.js';
// Formatting helpers removed — moved to Layer 2

const logger = createLogger('ReminderHelpers');

async function _fetchProtocolsForUsers(userIdsByHHMM: Record<string, string[]>, correlationId: string) {
  const allProtocols: any[] = [];
  for (const [hhmm, ids] of Object.entries(userIdsByHHMM)) {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const today = getTodayLocal();
      const { data, error } = await supabase
        .from('protocols')
        .select(`
          id, user_id, name, time_schedule, medicine_id, dosage_per_intake, intake_unit, treatment_plan_id, frequency, weekdays, start_date,
          medicine:medicines(name, dosage_unit, dosage_per_pill),
          treatment_plan:treatment_plans(id, name)
        `)
        .in('user_id', chunk)
        .eq('active', true)
        .lte('start_date', today)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .contains('time_schedule', JSON.stringify([hhmm])); 

      if (error) {
        logger.error(`Erro ao buscar protocolos para HHMM ${hhmm} (Batch ${Math.floor(i/50) + 1})`, error, { correlationId });
        continue;
      }
      if (data) allProtocols.push(...data);
    }
  }
  return allProtocols;
}

async function _processUserReminderBlock(userId: string, currentHHMM: string, currentHour: number, block: any, dispatcher: any, correlationId: string) {
  const normalizedKind = block.kind?.toLowerCase();
  if (['by_plan', 'misc'].includes(normalizedKind)) {
    const notificationType = 'dose_reminder_' + normalizedKind;
    const options = normalizedKind === 'by_plan' ? { planId: block.planId } : {};
    const shouldSend = await shouldSendGroupedNotification(userId, notificationType, options);
    if (!shouldSend) {
      const logContext: { userId: string; correlationId: string; planId?: string } = { userId, correlationId };
      if (block.planId) logContext.planId = block.planId;
      logger.debug('Dose reminder ' + normalizedKind + ' suprimido por deduplicação', logContext);
      return;
    }
  }

  let kind, data;

  if (block.kind === 'by_plan') {
    kind = 'dose_reminder_by_plan';
    data = {
      planId: block.planId, planName: block.planName, scheduledTime: currentHHMM,
      hour: currentHour, doses: block.doses, protocolIds: block.doses.map(d => d.protocolId),
    };
  } else if (block.kind === 'misc') {
    kind = 'dose_reminder_misc';
    data = {
      scheduledTime: currentHHMM, hour: currentHour, doses: block.doses, protocolIds: block.doses.map(d => d.protocolId),
    };
  } else {
    const dose = block.doses[0];
    kind = 'dose_reminder';
    data = {
      medicineName: dose.medicineName, 
      protocolId: dose.protocolId, 
      medicineId: dose.medicineId, 
      time: currentHHMM,
      dosagePerIntake: dose.dosagePerIntake,
      dosageUnit: dose.dosageUnit,
      intakeUnit: dose.intakeUnit ?? null,
      hour: currentHour
    };
  }

  const result = await dispatcher.dispatch({
    userId, kind, data, context: { correlationId, jobType: 'dose_reminder_dispatcher' },
  });

  if (!result.success) {
    logger.error('Falha no dispatch do bloco de dose', null, {
      userId, kind, planId: block.planId, errors: result.errors, correlationId,
    });
  }
}

async function _fetchDueInstancesForReminder(userIds, windowStart, windowEnd) {
  if (!userIds || userIds.length === 0) return [];

  const selectFields = `
    id, user_id, protocol_id, critical_alarm, scheduled_for,
    protocol:protocols(
      id, name, dosage_per_intake, intake_unit, treatment_plan_id, medicine_id,
      medicine:medicines(name, dosage_unit, dosage_per_pill),
      treatment_plan:treatment_plans(id, name)
    )
  `;

  // Duas queries separadas: (1) doses no horário previsto sem snooze;
  // (2) doses adiadas cujo snoozed_until cai na janela atual.
  // Evita falso-positivo de doses muito atrasadas (sem lower bound em scheduled_for).
  const [{ data: nonSnoozed, error: e1 }, { data: snoozedDue, error: e2 }] = await Promise.all([
    supabase
      .from('dose_instances')
      .select(selectFields)
      .in('user_id', userIds)
      .eq('status', 'pending')
      .is('notified_at', null)
      .is('snoozed_until', null)
      .gte('scheduled_for', windowStart)
      .lt('scheduled_for', windowEnd),
    supabase
      .from('dose_instances')
      .select(selectFields)
      .in('user_id', userIds)
      .eq('status', 'pending')
      .not('snoozed_until', 'is', null)
      .gte('snoozed_until', windowStart)
      .lt('snoozed_until', windowEnd),
  ]);

  if (e1) logger.error('Erro ao buscar dose_instances (não-snoozed)', e1);
  if (e2) logger.error('Erro ao buscar dose_instances (snoozed)', e2);
  return [...(nonSnoozed || []), ...(snoozedDue || [])];
}

async function _updateNotifiedAt(instanceIds) {
  if (!instanceIds || instanceIds.length === 0) return;
  const { error } = await supabase
    .from('dose_instances')
    .update({
      notified_at: getServerTimestamp(),
      snoozed_until: null
    })
    .in('id', instanceIds);
  if (error) {
    logger.error('Erro ao atualizar notified_at em dose_instances', error, { instanceIds });
  }
}

/**
 * Mapeia uma dose_instance para o formato esperado pelo dispatcher.
 * @private
 */
function mapInstanceToDose(inst) {
  const protocol = inst.protocol || {};
  const medicine = protocol.medicine || {};
  const protocolName = protocol.name || '';
  const medicineName = medicine.name || protocolName;
  const dosagePerPill =
    medicine.dosage_per_pill !== null && medicine.dosage_per_pill !== undefined
      ? Number(medicine.dosage_per_pill)
      : null;

  return {
    instanceId: inst.id,
    protocolId: inst.protocol_id,
    protocolName,
    medicineName,
    treatmentPlanId: protocol.treatment_plan_id ?? null,
    treatmentPlanName: protocol.treatment_plan?.name ?? null,
    dosagePerIntake: protocol.dosage_per_intake ?? 1,
    dosageUnit: medicine.dosage_unit,
    dosagePerPill,
    intakeUnit: protocol.intake_unit ?? null,
    medicineId: protocol.medicine_id,
    critical_alarm: inst.critical_alarm ?? false,
    // Horário ORIGINAL agendado da ocorrência (não o instante de saída do push). Sem isto, doses
    // adiadas (snooze) re-disparadas imprimiam a hora da soneca no body em vez da agendada.
    scheduledFor: inst.scheduled_for ?? null,
  };
}

/**
 * Formata um instante absoluto (ISO) como HH:mm no fuso do usuário.
 * @private
 */
function _formatScheduledLabel(scheduledFor, userTz, fallback) {
  if (!scheduledFor) return fallback;
  const dt = parseISO(scheduledFor);
  // dt null/undefined → Number.isNaN(undefined) é false, não captura; checar explicitamente.
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return fallback;
  const fmt = (tz) => new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(dt);
  try {
    // userTz vem do DB → pode ser inválido e Intl lança RangeError. Fallback p/ SP, depois p/ label.
    return fmt(userTz || 'America/Sao_Paulo');
  } catch {
    try { return fmt('America/Sao_Paulo'); } catch { return fallback; }
  }
}

/**
 * Executa o dispatch de um bloco individual de doses da dose_instance.
 * @private
 */
async function _dispatchSingleBlock(userId, block, currentHHMM, currentHour, dispatcher, correlationId, userTz) {
  const instanceIdsInBlock = block.doses.map(d => d.instanceId).filter(Boolean);
  const isBlockCritical = block.doses.some(d => d.critical_alarm === true);

  // Horário do body = instante ORIGINAL agendado da dose (não o de saída do push). Doses do mesmo
  // bloco compartilham o minuto (partitionDoses). Fallback p/ currentHHMM se scheduled_for ausente.
  const scheduledLabel = _formatScheduledLabel(block.doses[0]?.scheduledFor, userTz, currentHHMM);

  let kind, data;

  if (block.kind === 'by_plan') {
    kind = 'dose_reminder_by_plan';
    data = {
      planId: block.planId,
      planName: block.planName,
      scheduledTime: scheduledLabel,
      hour: currentHour,
      doses: block.doses,
      protocolIds: block.doses.map(d => d.protocolId),
      critical_alarm: isBlockCritical,
    };
  } else if (block.kind === 'misc') {
    kind = 'dose_reminder_misc';
    data = {
      scheduledTime: scheduledLabel,
      hour: currentHour,
      doses: block.doses,
      protocolIds: block.doses.map(d => d.protocolId),
      critical_alarm: isBlockCritical,
    };
  } else {
    const dose = block.doses[0];
    kind = 'dose_reminder';
    data = {
      medicineName: dose.medicineName,
      protocolId: dose.protocolId,
      medicineId: dose.medicineId,
      time: scheduledLabel,
      dosagePerIntake: dose.dosagePerIntake,
      dosageUnit: dose.dosageUnit,
      dosagePerPill: dose.dosagePerPill,
      intakeUnit: dose.intakeUnit ?? null,
      hour: currentHour,
      critical_alarm: dose.critical_alarm ?? false,
    };
  }

  const result = await dispatcher.dispatch({
    userId,
    kind,
    data,
    context: { correlationId, jobType: 'dose_reminder_instances' },
  });

  if (result.success) {
    await _updateNotifiedAt(instanceIdsInBlock);
  } else {
    logger.error('Falha no dispatch (instances)', null, {
      userId,
      kind,
      errors: result.errors,
      correlationId,
    });
  }
}

/**
 * Organiza e envia os blocos de notificação para um usuário específico.
 * @private
 */
async function _dispatchUserReminderBlocks(
  userId,
  dosesNow,
  windowStart,
  eligibleUsers,
  dispatcher,
  correlationId
) {
  if (dosesNow.length === 0) return;

  const criticalDoses = dosesNow.filter(d => d.critical_alarm === true);
  const nonCriticalDoses = dosesNow.filter(d => !d.critical_alarm);

  const blocks = [];
  if (criticalDoses.length > 0) {
    blocks.push(...partitionDoses(criticalDoses));
  }
  if (nonCriticalDoses.length > 0) {
    blocks.push(...partitionDoses(nonCriticalDoses));
  }
  const userTz = eligibleUsers.find(u => u.user_id === userId)?.timezone || 'America/Sao_Paulo';
  const currentHour = parseInt(
    parseISO(windowStart).toLocaleString('en-US', { timeZone: userTz, hour: 'numeric', hour12: false }),
    10
  );
  const currentHHMM = new Intl.DateTimeFormat('en-GB', {
    timeZone: userTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parseISO(windowStart));

  for (const block of blocks) {
    await _dispatchSingleBlock(userId, block, currentHHMM, currentHour, dispatcher, correlationId, userTz);
  }
}

async function _checkRemindersFromInstances(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode');
    if (userError) throw userError;

    // Spec 041: push-to-start da Live Activity (iOS) — janela PRÓPRIA (now + lead), independente das
    // doses devidas-agora. Best-effort + fail-open (não pode derrubar o reminder nem o alarme).
    // Roda antes do early-return das doses-devidas (janela diferente). Critical-only + opt-in (só
    // dispara se o device registrou token apns_liveactivity).
    try {
      const la = await dispatchLiveActivityStarts({ supabase, logger });
      if (la.sent > 0) logger.info('push-to-start LA disparado', { ...la, correlationId });
    } catch (laErr) {
      logger.error('push-to-start LA falhou (fail-open, ignorado)', laErr, { correlationId });
    }

    // Spec 041 Fase 2 (fix-up): ciclo de vida da LA (update de estado + end na resolução) via push,
    // p/ as LAs iOS ativas (la_push_token). Independente da janela do reminder. Best-effort + fail-open.
    try {
      const laLife = await dispatchLiveActivityLifecycle({ supabase, logger });
      if (laLife.updated > 0 || laLife.ended > 0) logger.info('ciclo LA (update/end) disparado', { ...laLife, correlationId });
    } catch (laErr) {
      logger.error('ciclo LA falhou (fail-open, ignorado)', laErr, { correlationId });
    }

    const eligibleUsers = (users || []).filter(u => u.notification_mode !== 'digest');
    if (eligibleUsers.length === 0) {
      logger.info('Nenhum usuário elegível para reminder (instances)', { correlationId });
      return;
    }

    const userIds = eligibleUsers.map(u => u.user_id);

    const nowISO = getServerTimestamp();
    const windowStart = nowISO.slice(0, 16) + ':00.000Z';
    const windowEnd = addMinutes(1, parseISO(windowStart)).toISOString();

    const instances = await _fetchDueInstancesForReminder(userIds, windowStart, windowEnd);

    if (instances.length === 0) {
      logger.info('Nenhuma dose_instance devida no minuto atual', { correlationId });
      return;
    }

    const byUser = {};
    for (const inst of instances) {
      if (!byUser[inst.user_id]) byUser[inst.user_id] = [];
      byUser[inst.user_id].push(inst);
    }

    logger.info(`${instances.length} instância(s) devida(s) para ${Object.keys(byUser).length} usuário(s)`, {
      correlationId,
    });

    for (const userId of Object.keys(byUser)) {
      try {
        const userInstances = byUser[userId];
        const dosesNow = userInstances.map(mapInstanceToDose);
        await _dispatchUserReminderBlocks(
          userId,
          dosesNow,
          windowStart,
          eligibleUsers,
          dispatcher,
          correlationId
        );
      } catch (err) {
        logger.error('Erro ao processar lembretes (instances) do usuário', err, { userId, correlationId });
      }
    }

    logger.info('_checkRemindersFromInstances concluído', { correlationId });
  } catch (err) {
    logger.error('Erro crítico em _checkRemindersFromInstances', err, { correlationId });
  }
}

/**
 * Processa e envia os lembretes de notificação no modelo legado por usuário.
 * @private
 */
async function _dispatchLegacyRemindersForUser(
  userId,
  user,
  protocols,
  currentHHMM,
  currentHour,
  dispatcher,
  correlationId
) {
  const timezone = user.timezone || 'America/Sao_Paulo';
  const { weekday } = getCurrentDatePartsInTimezone(timezone);
  const todayStr = getTodayLocal();

  const dosesNow = protocols
    .filter(p => (p.time_schedule || []).includes(currentHHMM) && isProtocolActiveOnWeekday(p, weekday, todayStr))
    .map(p => ({
      protocolId: p.id,
      protocolName: p.name,
      medicineName: p.medicine?.name || p.name,
      treatmentPlanId: p.treatment_plan_id ?? null,
      treatmentPlanName: p.treatment_plan?.name ?? null,
      dosagePerIntake: p.dosage_per_intake ?? 1,
      dosageUnit: p.medicine?.dosage_unit,
      intakeUnit: p.intake_unit ?? null,
      medicineId: p.medicine_id,
    }));

  if (dosesNow.length === 0) return;

  const blocks = partitionDoses(dosesNow);

  logger.info(`${dosesNow.length} dose(s) → ${blocks.length} bloco(s) para userId=${userId} às ${currentHHMM}`, {
    correlationId,
    userId,
    blockKinds: blocks.map(b => b.kind),
  });

  for (const block of blocks) {
    await _processUserReminderBlock(userId, currentHHMM, currentHour, block, dispatcher, correlationId);
  }
}

/**
 * Check reminders via dispatcher com agrupamento por treatment_plan (Wave N1).
 */
export async function checkRemindersViaDispatcher(dispatcher, correlationId) {
  if (process.env.REMINDER_SOURCE === 'instances') {
    return _checkRemindersFromInstances(dispatcher, correlationId);
  }

  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode, quiet_hours_start, quiet_hours_end');

    if (userError) throw userError;

    const eligibleUsers = (users || []).filter(u => u.notification_mode !== 'digest');
    if (eligibleUsers.length === 0) {
      logger.info('Nenhum usuário elegível para dispatch de lembretes', { correlationId });
      return;
    }

    logger.info(`Iniciando verificação de lembretes para ${eligibleUsers.length} usuários`, { correlationId });

    const userTimes = new Map();
    const userIdsByHHMM = {};

    for (const user of eligibleUsers) {
      const currentHHMM = getCurrentTime().substring(0, 5);
      userTimes.set(user.user_id, currentHHMM);

      if (!userIdsByHHMM[currentHHMM]) userIdsByHHMM[currentHHMM] = [];
      userIdsByHHMM[currentHHMM].push(user.user_id);
    }

    const allProtocols = await _fetchProtocolsForUsers(userIdsByHHMM, correlationId);

    const protocolsByUser = {};
    for (const p of allProtocols) {
      if (!protocolsByUser[p.user_id]) protocolsByUser[p.user_id] = [];
      protocolsByUser[p.user_id].push(p);
    }

    for (const user of eligibleUsers) {
      const userId = user.user_id;
      try {
        const currentHHMM = userTimes.get(userId);
        const currentHour = parseInt(currentHHMM.split(':')[0], 10);
        const protocols = protocolsByUser[userId] || [];
        if (protocols.length === 0) continue;

        await _dispatchLegacyRemindersForUser(
          userId,
          user,
          protocols,
          currentHHMM,
          currentHour,
          dispatcher,
          correlationId
        );
      } catch (err) {
        logger.error('Erro ao processar lembretes do usuário via dispatcher', err, { userId, correlationId });
      }
    }

    logger.info('CheckReminders (Dispatcher) concluído', { correlationId });
  } catch (err) {
    logger.error('Erro crítico em checkRemindersViaDispatcher', err, { correlationId });
  }
}

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
  const { data: row } = await supabase
    .from('user_settings')
    .select('notification_mode, digest_time, timezone, display_name')
    .eq('user_id', userId)
    .single();

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

async function _processUserStockAlert(userId, medicineId, stock, protocols, dispatcher, correlationId) {
  // 012 B4 / ADR-067: consumo diário via core (líquido → ml + cadência da frequência).
  // Antes somava a dose na unidade de tomada CRUA (UI/gotas) contra o saldo em ml →
  // `floor(ml ÷ UI)` = "0 dias" falso p/ insulina/GLP-1 (FR-013c). `calculateDailyIntake`
  // converte intake→ml via doseToMl (ADR-065 unit-aware) e aplica frequencyDailyFactor.
  const medicine = {
    dosage_unit: stock.dosageUnit,
    units_per_ml: stock.unitsPerMl,
    dosage_per_pill: stock.dosagePerPill,
  };

  const dailyIntake = calculateDailyIntake(medicineId, protocols, medicine);
  if (dailyIntake <= 0) return;

  const daysRemaining = calculateDaysRemaining(stock.qty, dailyIntake);
  if (!Number.isFinite(daysRemaining) || daysRemaining >= 7) return;

  // Dose-primário (ADR-067): exibir DOSES restantes (saldo ÷ tamanho de uma tomada),
  // não o saldo cru em ml rotulado "doses". Líquido converte a dose p/ ml (mesma
  // unidade do saldo); sólido usa unidades. Densidade ausente → doseToMl devolve a
  // dose crua (sem chute); fallback p/ saldo cru se não houver tamanho de dose.
  const rep = protocols[0] || {};
  const dosePorTomada = rep.dosage_per_intake || 1;
  const doseSize = isLiquidMedicine(medicine)
    ? doseToMl(dosePorTomada, rep.intake_unit, medicine.units_per_ml, medicine.dosage_per_pill)
    : dosePorTomada;
  // cleanFloat antes do floor (R-277): sem isso a dízima de float (0,3÷0,1=2,9999…)
  // gera off-by-one no nº de doses exibido.
  const dosesRemaining = doseSize > 0
    ? Math.floor(cleanFloat(stock.qty / doseSize))
    : Math.floor(stock.qty);

  logger.info(`Disparando alerta de estoque baixo: ${stock.name} (${daysRemaining} dias / ${dosesRemaining} doses)`, {
    userId, medicineId, correlationId
  });

  const data = {
    medicineName: stock.name,
    remaining: dosesRemaining,
    daysRemaining
  };

  await dispatcher.dispatch({
    userId, kind: 'stock_alert', data, context: { correlationId, jobType: 'stock_alert_dispatcher' }
  });
}

function _buildProtocolsAndStockMaps(allProtocols, allStock) {
  const protocolsByMedicine = {};
  for (const p of allProtocols || []) {
    const key = `${p.user_id}_${p.medicine_id}`;
    if (!protocolsByMedicine[key]) protocolsByMedicine[key] = [];
    protocolsByMedicine[key].push(p);
  }

  const stockByMedicine = {};
  for (const s of allStock || []) {
    const key = `${s.user_id}_${s.medicine_id}`;
    if (!stockByMedicine[key]) {
      // Campos do medicine p/ conversão líquida (012 B4 / R-267): unitsPerMl/dosageUnit/
      // dosagePerPill alimentam calculateDailyIntake + doseToMl no alerta de estoque.
      const med = s.medicine || {};
      stockByMedicine[key] = {
        qty: 0,
        name: med.name || 'Medicamento',
        unitsPerMl: med.units_per_ml,
        dosageUnit: med.dosage_unit,
        dosagePerPill: med.dosage_per_pill,
      };
    }
    stockByMedicine[key].qty += Number(s.quantity || 0);
  }

  return { protocolsByMedicine, stockByMedicine };
}

// 012 Fase A (ADR-059): dias restantes até a expiração biológica do lote.
// Espelha biologicalExpiryDaysLeft do @dosiq/core (server não importa o core).
// null = eixo inativo (lote fechado, sem TTL, data inválida ou clock skew).
function _biologicalExpiryDaysLeft(stockRow) {
  const openedAt = stockRow?.opened_at;
  const shelfDays = Number(stockRow?.medicine?.shelf_life_days);
  if (!openedAt || !Number.isFinite(shelfDays) || shelfDays <= 0) return null;
  const opened = parseISO(openedAt);
  if (Number.isNaN(opened.getTime())) return null;
  const nowMs = Date.now();
  if (opened.getTime() > nowMs) return null;
  const MS_DAY = 24 * 60 * 60 * 1000;
  const expiresAtMs = opened.getTime() + shelfDays * MS_DAY;
  // Diferença por DATA-CALENDÁRIO em America/Sao_Paulo, não por janelas de 24h
  // sobre o instante do cron (review Gemini #658: atraso do cron fazia floor()
  // pular de 3 pra 2 e silenciar o D-3 — cadência === 3 || === 0 exige dia exato).
  const dayKey = (ms) => {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
      .format(ms).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((dayKey(expiresAtMs) - dayKey(nowMs)) / MS_DAY);
}

async function _processBiologicalExpiryAlerts(allStock, dispatcher, correlationId) {
  for (const lot of allStock || []) {
    try {
      if (Number(lot.quantity || 0) <= 0) continue;
      const daysLeft = _biologicalExpiryDaysLeft(lot);
      if (daysLeft === null) continue;
      // Cadência D-3 + vencimento (FR-004b): cada condição ocorre 1 dia só.
      if (daysLeft !== 3 && daysLeft !== 0) continue;

      const medicineName = lot.medicine?.name || 'Medicamento';
      logger.info(`Disparando alerta de validade biológica: ${medicineName} (daysLeft=${daysLeft})`, {
        userId: lot.user_id, medicineId: lot.medicine_id, correlationId
      });

      await dispatcher.dispatch({
        userId: lot.user_id,
        kind: 'stock_expiry_alert',
        data: { medicineName, daysLeft },
        context: { correlationId, jobType: 'stock_expiry_alert_dispatcher' }
      });
    } catch (err) {
      // Best-effort por lote (R-245): um lote com erro não derruba a varredura.
      logger.error('Erro ao processar alerta de validade biológica', err, {
        userId: lot?.user_id, medicineId: lot?.medicine_id, correlationId
      });
    }
  }
}

export async function checkStockAlertsViaDispatcher(dispatcher, correlationId) {
  try {
    // 044 (FR-006 / PO-4): a preferência vem no MESMO fetch de settings — nenhuma query extra.
    const { data: users, error: usersErr } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode, stock_tracking_enabled');

    if (usersErr || !users || users.length === 0) {
      logger.info('Nenhum usuário encontrado em user_settings para alertas de estoque', { correlationId });
      return;
    }

    // Usuário em modo dose-only não recebe NENHUM alerta de estoque (volume ou validade).
    // Fail-safe (AP-277): coluna ausente/NULL → tratado como TRACKING LIGADO (paridade com o
    // COALESCE das RPCs atômicas). A ausência de dado nunca silencia alerta por omissão.
    const stockTrackingOff = new Set(
      users.filter(u => u.stock_tracking_enabled === false).map(u => u.user_id)
    );
    const trackingUsers = users.filter(u => !stockTrackingOff.has(u.user_id));

    if (trackingUsers.length === 0) {
      logger.info('Nenhum usuário com controle de estoque ativo — alertas de estoque pulados', { correlationId });
      return;
    }

    const userIds = trackingUsers.map(u => u.user_id);
    logger.info(`Verificando alertas de estoque para ${userIds.length} usuários`, {
      correlationId, doseOnlySkipped: stockTrackingOff.size
    });

    // R-267 read-path: intake_unit + active (calculateDailyIntake filtra p.active e
    // converte por intake_unit); units_per_ml/dosage_unit/dosage_per_pill p/ a conversão
    // líquida (ADR-065/ADR-067 — antes o cron contava UI cru contra ml).
    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('user_id, medicine_id, time_schedule, dosage_per_intake, intake_unit, frequency, weekdays, active')
      .eq('active', true)
      .in('user_id', userIds);

    const { data: allStock } = await supabase
      .from('stock')
      .select('user_id, medicine_id, quantity, opened_at, medicine:medicines(name, shelf_life_days, units_per_ml, dosage_unit, dosage_per_pill)')
      .in('user_id', userIds);

    const { protocolsByMedicine, stockByMedicine } = _buildProtocolsAndStockMaps(allProtocols, allStock);

    for (const key in stockByMedicine) {
      const [userId, medicineId] = key.split('_');
      const stock = stockByMedicine[key];
      const protocols = protocolsByMedicine[key] || [];

      if (protocols.length === 0) continue;

      await _processUserStockAlert(userId, medicineId, stock, protocols, dispatcher, correlationId);
    }

    // 012 Fase A (ADR-059): validade biológica (TTL pós-abertura) — eixo POR LOTE,
    // paralelo ao alerta de volume acima. Cadência sem estado extra: o cron é
    // diário, então daysLeft === 3 (D-3) e daysLeft === 0 (vence hoje) ocorrem em
    // exatamente 1 execução cada. Lote já vencido há dias (daysLeft < 0) não
    // re-alerta (sem spam retroativo). Lote vazio (quantity <= 0) não interessa.
    await _processBiologicalExpiryAlerts(allStock, dispatcher, correlationId);

    logger.info('Verificação de alertas de estoque concluída', { correlationId });
  } catch (err) {
    logger.error('Erro em checkStockAlertsViaDispatcher', err, { correlationId });
  }
}

// Helper para obter a duração em dias de uma etapa de titulação.
function _getTitrationStageDays(stage) {
  const days = Number(stage?.duration_days ?? stage?.days);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

// 012 Fase B (FR-005b): detecta etapas de titulação vencidas por cronograma.
// Caminha o schedule a partir de stage_started_at somando duration (days);
// retorna null se nada venceu. stage_started_at novo = fim ACUMULADO da etapa
// anterior (fiel ao cronograma), não now() — atraso do cron não desloca etapas.
export function _titrationDueAdvance(protocol, nowMs) {
  const schedule = protocol?.titration_schedule;
  if (!Array.isArray(schedule) || schedule.length === 0) return null;
  if (protocol.titration_status !== 'titulando') return null;
  if (!protocol.stage_started_at) return null;

  let index = protocol.current_stage_index || 0;
  if (index >= schedule.length) return null;
  let startMs = parseISO(protocol.stage_started_at).getTime();
  if (Number.isNaN(startMs)) return null;

  const MS_DAY = 24 * 60 * 60 * 1000;
  let advanced = false;
  let reachedTarget = false;
  while (index < schedule.length) {
    // duration_days = canônico (titrationStageSchema); days = fallback legado
    const days = _getTitrationStageDays(schedule[index]);
    if (days === 0) break;
    const endMs = startMs + days * MS_DAY;
    if (nowMs < endMs) break;
    if (index === schedule.length - 1) {
      // Última etapa esgotada → dose alvo atingida (índice congela na última).
      reachedTarget = true;
      break;
    }
    startMs = endMs;
    index += 1;
    advanced = true;
  }
  if (!advanced && !reachedTarget) return null;
  return { newIndex: index, newStageStartedAt: parseTimestamp(startMs).toISOString(), reachedTarget };
}

// 012 Fase B2 (FR-021): Dispara o alerta de transição de etapa de titulação.
async function _dispatchTitrationAlert(userId, protocol, due, dispatcher, correlationId) {
  const medicine = protocol.medicine || {};
  const schedule = protocol.titration_schedule;
  const nextStageData = schedule?.[due.newIndex + 1];
  const enteredStage = schedule?.[due.newIndex];
  const requiresNewMedicine = Boolean(enteredStage?.requires_new_medicine) && !due.reachedTarget;

  logger.info(`Titulação avançada por cronograma: etapa ${due.newIndex + 1}/${schedule.length}${due.reachedTarget ? ' (alvo atingido)' : ''}${requiresNewMedicine ? ' (requer nova apresentação)' : ''}`, {
    userId, protocolId: protocol.id, correlationId
  });

  const data = {
    medicineName: medicine.name || 'Medicamento',
    currentStage: due.newIndex + 1,
    totalStages: schedule.length,
    status: due.reachedTarget ? 'alvo_atingido' : 'titulando',
    requiresNewMedicine,
    nextStage: !due.reachedTarget && nextStageData ? {
      dosage: String(nextStageData.dosage),
      unit: medicine.dosage_unit || 'mg',
      date: nextStageData.date
    } : undefined
  };

  await dispatcher.dispatch({
    userId, kind: 'titration_alert', data, context: { correlationId, jobType: 'titration_alert' }
  });
}

// 012 Fase B (FR-005b): avanço AUTOMÁTICO por cronograma + notificação SÓ no
// evento (antes o cron disparava titration_alert todo dia para todo protocolo
// em titulação — spam sem informação nova; regressão corrigida em T009).
// Evento informativo, sem CTA de dose (SaMD/ADR-062).
async function _processProtocolTitration(userId, protocol, dispatcher, correlationId) {
  const due = _titrationDueAdvance(protocol, Date.now());
  if (!due) return;

  const updatePayload: { current_stage_index: any; stage_started_at: any; titration_status?: string } = {
    current_stage_index: due.newIndex,
    stage_started_at: due.newStageStartedAt,
  };
  if (due.reachedTarget) updatePayload.titration_status = 'alvo_atingido';

  // Trava otimista (AP-221): confirma que a linha ainda está na etapa esperada
  // antes de avançar. Se o usuário mexeu na titulação manualmente entre o SELECT
  // do cron e este UPDATE, PostgREST faz no-op (0 linhas, sem erro) → não dispara
  // notificação de avanço sobre estado obsoleto.
  const { data: updatedRows, error: updateErr } = await supabase
    .from('protocols')
    .update(updatePayload)
    .eq('id', protocol.id)
    .eq('current_stage_index', protocol.current_stage_index ?? 0)
    .select('id');
  if (updateErr) throw updateErr; // best-effort por protocolo no caller (R-245)
  if (!updatedRows || updatedRows.length === 0) return; // etapa mudou sob o cron → aborta

  await _dispatchTitrationAlert(userId, protocol, due, dispatcher, correlationId);
}

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
      
      // 012 Fase B: stage_started_at no select (R-267 — sem ele o cron não sabia
      // se a transição venceu e notificava diariamente); só 'titulando' interessa.
      const { data: protocols } = await (supabase as any)
        .from('protocols')
        .select(`
          id, current_stage_index, titration_schedule, titration_status, stage_started_at,
          medicine:medicine_id (name, dosage_unit)
        `)
        .eq('user_id', userId)
        .eq('status', 'ativo')
        .eq('titration_status', 'titulando')
        .not('titration_schedule', 'is', null);

      if (!protocols || protocols.length === 0) continue;

      for (const protocol of protocols) {
        try {
          await _processProtocolTitration(userId, protocol, dispatcher, correlationId);
        } catch (err) {
          // Best-effort por protocolo (R-245): erro num avanço não derruba a varredura.
          logger.error('Erro ao processar avanço de titulação', err, {
            userId, protocolId: protocol?.id, correlationId
          });
        }
      }
    }
  } catch (err) {
    logger.error('Erro em checkTitrationAlertsViaDispatcher', err, { correlationId });
  }
}

async function _processPrescriptionProtocol(userId, protocol, todayDate, dispatcher, correlationId) {
  const endDate = parseLocalDate(protocol.end_date);
  const diffTime = endDate.getTime() - todayDate.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const alertDays = [30, 7, 1];
  if (!alertDays.includes(daysRemaining)) return;

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

export async function checkPrescriptionAlertsViaDispatcher(dispatcher: any, correlationId: string) {
  try {
    const { data: users, error: userError } = await (supabase as any)
      .from('user_settings')
      .select('user_id, timezone')
      .eq('notifications_enabled', true);

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    logger.info(`Iniciando alertas de prescrição via Dispatcher para ${users.length} usuários`, { correlationId });

    for (const user of users) {
      const userId = user.user_id;
      const todayDate = parseLocalDate(getTodayLocal());

      const { data: protocols } = await (supabase as any)
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
        await _processPrescriptionProtocol(userId, protocol, todayDate, dispatcher, correlationId);
      }
    }
  } catch (err) {
    logger.error('Erro em checkPrescriptionAlertsViaDispatcher', err, { correlationId });
  }
}
