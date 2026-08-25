import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { shouldSendGroupedNotification } from '../../services/notificationDeduplicator.js';
import { getCurrentTime, getTodayLocal, getCurrentDatePartsInTimezone, getServerTimestamp, parseISO, addMinutes } from '../../utils/dateUtils.js';
import { partitionDoses } from '../utils/partitionDoses.js';
import { isProtocolActiveOnWeekday } from '../../utils/protocolActiveHelper.js';
import { dispatchLiveActivityStarts } from '../../notifications/apns/dispatchLiveActivityStarts.js';
import { dispatchLiveActivityLifecycle } from '../../notifications/apns/dispatchLiveActivityLifecycle.js';
import {
  resolveInstanceMedicine,
} from '@dosiq/core';

const logger = createLogger('DoseReminders');

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

  // 052 Slice B: `medicine_id` + embed DIRETO da ocorrência (FK `dose_instances_medicine_id_fkey`).
  // O embed sob `protocol` some: ele resolvia a identidade pelo medicamento ATUAL do tratamento,
  // reescrevendo o passado a cada leitura. O protocolo segue no select pelo que é dele (nome,
  // dose por tomada, unidade de tomada, plano) — nunca mais pela identidade do medicamento.
  const selectFields = `
    id, user_id, protocol_id, critical_alarm, scheduled_for, medicine_id,
    notified_at, snoozed_until,
    medicine:medicines(name, dosage_unit, dosage_per_pill),
    protocol:protocols(
      id, name, dosage_per_intake, intake_unit, treatment_plan_id, medicine_id,
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

/**
 * Reivindica (claim) as instâncias ANTES do envio. O claim é o PREDICADO do próprio UPDATE
 * (AP-221/R-288): o Postgres toma row lock e o reavalia sobre a versão nova, então dois ciclos
 * concorrentes nunca reivindicam a mesma dose — o segundo recebe zero linhas no RETURNING.
 *
 * São DOIS predicados porque são duas populações, vindas das duas queries do fetch:
 *  - dose no horário previsto → `notified_at IS NULL` (e o update carimba `notified_at`);
 *  - dose ADIADA → `snoozed_until IS NOT NULL` (e o update zera `snoozed_until`).
 * Usar só `notified_at IS NULL` perderia a soneca vinda do mobile: `setSnoozedUntil`
 * (`createDoseInstanceRepository`) grava `snoozed_until` SEM zerar `notified_at` — ao contrário do
 * caminho do Telegram (`doseActions.ts`) — então a dose adiada chega ao claim já carimbada e um
 * predicado só a descartaria em silêncio. Ambos os predicados se auto-negam no mesmo UPDATE, logo
 * ambos são claims válidos.
 *
 * @private
 * @param {Array<{instanceId: string, snoozedUntil: string|null}>} doses
 * @returns ids reivindicados, o carimbo usado e `claimError` (erro de banco ≠ corrida perdida).
 */
async function _claimInstances(doses) {
  const targets = (doses || []).filter(d => d.instanceId);
  if (targets.length === 0) return { claimedIds: [], claimedAt: null, claimError: false };

  const claimedAt = getServerTimestamp();
  const snoozedIds = targets.filter(d => d.snoozedUntil).map(d => d.instanceId);
  const dueIds = targets.filter(d => !d.snoozedUntil).map(d => d.instanceId);

  const claimedIds = [];
  let claimError = false;

  if (dueIds.length > 0) {
    const { data, error } = await supabase
      .from('dose_instances')
      .update({ notified_at: claimedAt, snoozed_until: null })
      .in('id', dueIds)
      .is('notified_at', null)
      .select('id');
    if (error) {
      logger.error('Erro ao reivindicar dose_instances devidas (claim)', error, { dueIds });
      claimError = true;
    } else {
      claimedIds.push(...(data || []).map(r => r.id));
    }
  }

  if (snoozedIds.length > 0) {
    const { data, error } = await supabase
      .from('dose_instances')
      .update({ notified_at: claimedAt, snoozed_until: null })
      .in('id', snoozedIds)
      .not('snoozed_until', 'is', null)
      .select('id');
    if (error) {
      logger.error('Erro ao reivindicar dose_instances adiadas (claim)', error, { snoozedIds });
      claimError = true;
    } else {
      claimedIds.push(...(data || []).map(r => r.id));
    }
  }

  return { claimedIds, claimedAt, claimError };
}

/**
 * Devolve as instâncias ao estado PRÉ-claim quando o dispatch falha depois de reivindicar
 * (FR-006a) — uma falha transitória de push não pode consumir a dose.
 *
 * Restaura `notified_at` E `snoozed_until` aos valores originais: o claim zera a soneca, e
 * devolver só o `notified_at` deixaria a dose adiada sem marcador de soneca — invisível para as
 * DUAS queries do fetch (o `scheduled_for` dela já passou).
 *
 * O `.eq('notified_at', claimedAt)` é obrigatório: sem ele um release atrasado apagaria o carimbo
 * de OUTRO worker e reintroduziria o envio duplo pela própria correção.
 * @private
 */
async function _releaseInstances(doses, claimedIds, claimedAt) {
  if (!claimedAt || !claimedIds || claimedIds.length === 0) return;
  const claimed = new Set(claimedIds);
  for (const dose of (doses || [])) {
    if (!claimed.has(dose.instanceId)) continue;
    const { error } = await supabase
      .from('dose_instances')
      .update({ notified_at: dose.notifiedAt ?? null, snoozed_until: dose.snoozedUntil ?? null })
      .eq('id', dose.instanceId)
      .eq('notified_at', claimedAt);
    if (error) {
      logger.error('Erro ao liberar dose_instance após falha de dispatch', error, {
        instanceId: dose.instanceId,
      });
    }
  }
}

/**
 * Carimba `notified_at` DEPOIS do envio. Usado só no fallback de erro de banco no claim — o
 * caminho normal carimba antes (ver `_claimInstances`).
 * @private
 */
async function _updateNotifiedAt(instanceIds) {
  if (!instanceIds || instanceIds.length === 0) return;
  const { error } = await supabase
    .from('dose_instances')
    .update({ notified_at: getServerTimestamp(), snoozed_until: null })
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
  // 052 Slice B: identidade pelo snapshot da ocorrência (helper canônico), nunca pelo join.
  const { medicineId, medicine: resolvedMedicine } = resolveInstanceMedicine<{
    name?: string;
    dosage_unit?: string;
    dosage_per_pill?: number | string | null;
  }>(inst, { protocol });
  const medicine = resolvedMedicine || {};
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
    medicineId,
    critical_alarm: inst.critical_alarm ?? false,
    // Horário ORIGINAL agendado da ocorrência (não o instante de saída do push). Sem isto, doses
    // adiadas (snooze) re-disparadas imprimiam a hora da soneca no body em vez da agendada.
    scheduledFor: inst.scheduled_for ?? null,
    // Estado PRÉ-claim: define qual predicado reivindica esta dose e o que o release restaura.
    ..._claimStateOf(inst),
  };
}

/**
 * Estado pré-claim da ocorrência. Fora de `mapInstanceToDose` de propósito (limite de complexidade).
 * @private
 */
function _claimStateOf(inst) {
  return {
    notifiedAt: inst.notified_at ?? null,
    snoozedUntil: inst.snoozed_until ?? null,
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

  // Claim ANTES do dispatch: só é enviado o que este ciclo conseguiu reivindicar.
  const { claimedIds, claimedAt, claimError } = await _claimInstances(block.doses);
  let claimedBlock = block;
  if (instanceIdsInBlock.length > 0 && !claimError) {
    if (claimedIds.length === 0) {
      // Corrida perdida: outro ciclo já reivindicou o bloco. Não é erro.
      logger.debug('Bloco de doses já reivindicado por outro ciclo — nada a enviar', {
        userId, correlationId,
      });
      return;
    }
    // Claim parcial: manter no bloco só as doses desta reivindicação.
    const claimedSet = new Set(claimedIds);
    claimedBlock = { ...block, doses: block.doses.filter(d => claimedSet.has(d.instanceId)) };
  } else if (claimError) {
    // Erro de BANCO no claim ≠ corrida perdida. Tratar como corrida perdida transformaria uma
    // instabilidade do Postgres em lembrete não entregue. Degrada para o comportamento antigo
    // (envia e carimba depois): o risco reintroduzido é o duplo teórico, só durante a falha.
    logger.error('Claim indisponível — enviando sem reivindicar (fail-open na entrega)', null, {
      userId, correlationId, instanceIdsInBlock,
    });
  }

  const isBlockCritical = claimedBlock.doses.some(d => d.critical_alarm === true);

  // Horário do body = instante ORIGINAL agendado da dose (não o de saída do push). Doses do mesmo
  // bloco compartilham o minuto (partitionDoses). Fallback p/ currentHHMM se scheduled_for ausente.
  const scheduledLabel = _formatScheduledLabel(claimedBlock.doses[0]?.scheduledFor, userTz, currentHHMM);

  let kind, data;

  if (claimedBlock.kind === 'by_plan') {
    kind = 'dose_reminder_by_plan';
    data = {
      planId: claimedBlock.planId,
      planName: claimedBlock.planName,
      scheduledTime: scheduledLabel,
      hour: currentHour,
      doses: claimedBlock.doses,
      protocolIds: claimedBlock.doses.map(d => d.protocolId),
      critical_alarm: isBlockCritical,
    };
  } else if (claimedBlock.kind === 'misc') {
    kind = 'dose_reminder_misc';
    data = {
      scheduledTime: scheduledLabel,
      hour: currentHour,
      doses: claimedBlock.doses,
      protocolIds: claimedBlock.doses.map(d => d.protocolId),
      critical_alarm: isBlockCritical,
    };
  } else {
    const dose = claimedBlock.doses[0];
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

  if (!result.success) {
    logger.error('Falha no dispatch (instances)', null, {
      userId,
      kind,
      errors: result.errors,
      correlationId,
    });
    // Devolve a dose ao estado pré-claim — falha de push não pode consumir a dose em silêncio.
    await _releaseInstances(claimedBlock.doses, claimedIds, claimedAt);
  } else if (claimError) {
    await _updateNotifiedAt(instanceIdsInBlock);
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
