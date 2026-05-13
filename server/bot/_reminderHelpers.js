import { supabase } from '../services/supabase.js';
import { createLogger } from '../bot/logger.js';
import { shouldSendNotification, shouldSendGroupedNotification } from '../services/notificationDeduplicator.js';
import { getCurrentTime, getCurrentTimeInTimezone, parseLocalDate, getTodayLocal } from '../utils/dateUtils.js';
import { partitionDoses } from './utils/partitionDoses.js';
// Formatting helpers removed — moved to Layer 2

const logger = createLogger('ReminderHelpers');

async function _fetchProtocolsForUsers(userIdsByHHMM, correlationId) {
  const allProtocols = [];
  for (const [hhmm, ids] of Object.entries(userIdsByHHMM)) {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const today = getTodayLocal();
      const { data, error } = await supabase
        .from('protocols')
        .select(`
          id, user_id, name, time_schedule, medicine_id, dosage_per_intake, treatment_plan_id,
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

async function _processUserReminderBlock(userId, currentHHMM, currentHour, block, dispatcher, correlationId) {
  const normalizedKind = block.kind?.toLowerCase();
  if (['by_plan', 'misc'].includes(normalizedKind)) {
    const notificationType = 'dose_reminder_' + normalizedKind;
    const options = normalizedKind === 'by_plan' ? { planId: block.planId } : {};
    const shouldSend = await shouldSendGroupedNotification(userId, notificationType, options);
    if (!shouldSend) {
      const logContext = { userId, correlationId };
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
      dosageUnit: dose.dosageUnit
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

/**
 * Check reminders via dispatcher com agrupamento por treatment_plan (Wave N1).
 */
export async function checkRemindersViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode, quiet_hours_start, quiet_hours_end');

    if (userError) throw userError;

    // digest mode tem mecanismo próprio (daily_digest); excluir apenas digest, não silent
    // silent users chegam ao dispatcher que loga 'silenciada' → aparece no inbox
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

        const dosesNow = protocols
          .filter(p => (p.time_schedule || []).includes(currentHHMM))
          .map(p => ({
            protocolId: p.id,
            protocolName: p.name,
            medicineName: p.medicine?.name || p.name,
            treatmentPlanId: p.treatment_plan_id ?? null,
            treatmentPlanName: p.treatment_plan?.name ?? null,
            dosagePerIntake: p.dosage_per_intake ?? 1,
            dosageUnit: p.medicine?.dosage_unit,
            medicineId: p.medicine_id,
          }));

        if (dosesNow.length === 0) continue;

        const blocks = partitionDoses(dosesNow);

        logger.info(`${dosesNow.length} dose(s) → ${blocks.length} bloco(s) para userId=${userId} às ${currentHHMM}`, {
          correlationId, userId, blockKinds: blocks.map(b => b.kind),
        });

        for (const block of blocks) {
          await _processUserReminderBlock(userId, currentHHMM, currentHour, block, dispatcher, correlationId);
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
      .select('*, medicine:medicines(name, dosage_unit, dosage_per_pill)')
      .in('user_id', eligibleIds)
      .eq('active', true)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`);

    const protocolsByUser = {};
    for (const p of allProtocols ?? []) {
      if (!protocolsByUser[p.user_id]) protocolsByUser[p.user_id] = [];
      protocolsByUser[p.user_id].push(p);
    }

    for (const { userId, displayName, digestTime } of eligibleEntries) {
      try {
        const protocols = protocolsByUser[userId] || [];

        const todaySchedule = [];
        protocols.forEach(p => {
          (p.time_schedule || []).forEach(time => {
            todaySchedule.push({
              time,
              medicineName: p.medicine?.name || p.name,
              dosagePerIntake: p.dosage_per_intake || 1,
              dosageUnit: p.medicine?.dosage_unit
            });
          });
        });
        todaySchedule.sort((a, b) => a.time.localeCompare(b.time));

        const currentHour = parseInt(digestTime.split(':')[0], 10);
        
        const data = {
          firstName: displayName || 'Paciente',
          hour: currentHour,
          pendingCount: todaySchedule.length,
          medicines: todaySchedule.map(s => ({
            name: s.medicineName, 
            time: s.time, 
            dosagePerIntake: s.dosagePerIntake,
            dosageUnit: s.dosageUnit
          }))
        };

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
  const dailyConsumption = protocols.reduce((sum, p) => {
    const intakesPerDay = (p.time_schedule || []).length;
    return sum + (intakesPerDay * (p.dosage_per_intake || 1));
  }, 0);

  if (dailyConsumption <= 0) return;

  const daysRemaining = Math.floor(stock.qty / dailyConsumption);

  if (daysRemaining < 7) {
    logger.info(`Disparando alerta de estoque baixo: ${stock.name} (${daysRemaining} dias restantes)`, {
      userId, medicineId, correlationId
    });

    const data = {
      medicineName: stock.name,
      remaining: stock.qty,
      daysRemaining
    };

    await dispatcher.dispatch({
      userId, kind: 'stock_alert', data, context: { correlationId, jobType: 'stock_alert_dispatcher' }
    });
  }
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
    if (!stockByMedicine[key]) stockByMedicine[key] = { qty: 0, name: s.medicine?.name || 'Medicamento' };
    stockByMedicine[key].qty += Number(s.quantity || 0);
  }

  return { protocolsByMedicine, stockByMedicine };
}

export async function checkStockAlertsViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: usersErr } = await supabase
      .from('user_settings')
      .select('user_id, timezone, notification_mode');

    if (usersErr || !users || users.length === 0) {
      logger.info('Nenhum usuário encontrado em user_settings para alertas de estoque', { correlationId });
      return;
    }

    const userIds = users.map(u => u.user_id);
    logger.info(`Verificando alertas de estoque para ${userIds.length} usuários`, { correlationId });

    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('user_id, medicine_id, time_schedule, dosage_per_intake')
      .eq('active', true)
      .in('user_id', userIds);

    const { data: allStock } = await supabase
      .from('stock')
      .select('user_id, medicine_id, quantity, medicine:medicines(name)')
      .in('user_id', userIds);

    const { protocolsByMedicine, stockByMedicine } = _buildProtocolsAndStockMaps(allProtocols, allStock);

    for (const key in stockByMedicine) {
      const [userId, medicineId] = key.split('_');
      const stock = stockByMedicine[key];
      const protocols = protocolsByMedicine[key] || [];

      if (protocols.length === 0) continue; 

      await _processUserStockAlert(userId, medicineId, stock, protocols, dispatcher, correlationId);
    }

    logger.info('Verificação de alertas de estoque concluída', { correlationId });
  } catch (err) {
    logger.error('Erro em checkStockAlertsViaDispatcher', err, { correlationId });
  }
}

async function _processProtocolTitration(userId, protocol, dispatcher, correlationId) {
  const medicine = protocol.medicine || {};
  const currentStage = (protocol.current_stage_index || 0) + 1;
  const totalStages = protocol.titration_schedule?.length || 0;
  const nextStageData = protocol.titration_schedule?.[protocol.current_stage_index + 1];

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
    userId, kind: 'titration_alert', data, context: { correlationId, jobType: 'titration_alert' }
  });
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
        await _processProtocolTitration(userId, protocol, dispatcher, correlationId);
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
      const todayDate = parseLocalDate(getTodayLocal());

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
        await _processPrescriptionProtocol(userId, protocol, todayDate, dispatcher, correlationId);
      }
    }
  } catch (err) {
    logger.error('Erro em checkPrescriptionAlertsViaDispatcher', err, { correlationId });
  }
}
