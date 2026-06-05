// quickDoseRegistration.js — processa as ações do alarme (Spec 001, FR-004/005)
//
// "Tomei" → VIA CANÔNICA registerDose(logData, { instanceId }) — cria medicine_log,
//   dispara consume_stock_fifo e ancora a dose_instance (status='taken' + medicine_log_id),
//   com rollback. NUNCA update cru de status (pularia estoque + coluna taken_at inexistente).
// "Pular" → dose_instances.status='skipped_user' (sem log, sem consumo).
// Ignorado → nag reativo (+5min, máx 3).
//
// Pós-interação: invalida os snapshots AsyncStorage REAIS (FR-005). As chaves
// @dosiq/dose-instances-snapshot e @dosiq/adherence-snapshot da spec legada NÃO
// existem (multiRemove delas = no-op silencioso, AP-168). Adesão vive em
// treatments-snapshot.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getRawNow } from '@dosiq/core'
import { registerDose } from '@dose/services/doseService'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { alarmService, ALARM_ACTION } from './alarmService'

// Chaves reais verificadas no repo (mobile). Adesão = treatments-snapshot.
const SNAPSHOTS_TAKEN = ['@dosiq/today-snapshot', '@dosiq/stock-snapshot', '@dosiq/treatments-snapshot']
const SNAPSHOTS_SKIP = ['@dosiq/today-snapshot', '@dosiq/treatments-snapshot']

async function invalidate(keys) {
  try {
    await AsyncStorage.multiRemove(keys)
  } catch {
    // best-effort — a UI re-busca na próxima abertura
  }
}

/**
 * Registra a tomada pela via canônica (medicine_log → consume_stock_fifo → âncora).
 * Reutilizado pelo handler de notificação E pela tela AlarmFullScreen.
 * @param {object} data - { doseInstanceId, protocolId, medicineId, quantityTaken }
 */
export async function registerTaken(data) {
  const { doseInstanceId, isGrouped, groupedDoses } = data || {}
  if (!doseInstanceId) return { success: false }
  // Silenciar PRIMEIRO: o usuário agiu — para o som/notif na hora.
  await alarmService.cancelAlarm(doseInstanceId)
  if (data.__dev) return { success: true, dev: true } // smoke do DevHub: sem DB

  if (isGrouped === 'true' && groupedDoses) {
    let doses = []
    try {
      doses = JSON.parse(groupedDoses)
    } catch {
      // fallback
    }

    if (doses.length > 0) {
      await Promise.all(
        doses.map(async (d) => {
          const quantity = d.dosagePerIntake != null ? Number(d.dosagePerIntake) : 1
          await registerDose(
            {
              protocol_id: d.protocolId || null,
              medicine_id: d.medicineId,
              taken_at: getRawNow().toISOString(),
              quantity_taken: quantity,
            },
            { instanceId: d.instanceId }
          )
        })
      )
      await invalidate(SNAPSHOTS_TAKEN)
      return { success: true }
    }
  }

  // Fallback para dose única
  const { protocolId, medicineId, quantityTaken } = data || {}
  const quantity = quantityTaken != null ? Number(quantityTaken) : 1
  await registerDose(
    {
      protocol_id: protocolId || null,
      medicine_id: medicineId,
      taken_at: getRawNow().toISOString(),
      quantity_taken: quantity,
    },
    { instanceId: doseInstanceId }
  )
  await invalidate(SNAPSHOTS_TAKEN)
  return { success: true }
}

/**
 * Pula a dose: status='skipped_user' (sem log, sem consumo).
 * @param {object} data - { doseInstanceId }
 */
export async function registerSkip(data) {
  const { doseInstanceId, isGrouped, groupedDoses } = data || {}
  if (!doseInstanceId) return { success: false }
  await alarmService.cancelAlarm(doseInstanceId) // silencia primeiro
  if (data.__dev) return { success: true, dev: true } // smoke do DevHub: sem DB

  if (isGrouped === 'true' && groupedDoses) {
    let doses = []
    try {
      doses = JSON.parse(groupedDoses)
    } catch {
      // fallback
    }

    if (doses.length > 0) {
      const ids = doses.map((d) => d.instanceId)
      await supabase.from('dose_instances').update({ status: 'skipped_user' }).in('id', ids)
      await invalidate(SNAPSHOTS_SKIP)
      return { success: true }
    }
  }

  // Fallback para dose única
  await supabase.from('dose_instances').update({ status: 'skipped_user' }).eq('id', doseInstanceId)
  await invalidate(SNAPSHOTS_SKIP)
  return { success: true }
}

/**
 * Processa o evento de ação do Notifee (foreground ou background handler).
 * @param {object} event - { type, detail: { notification, pressAction } }
 * @returns {Promise<{ handled: boolean, action?: string }>}
 */
// Args compartilhados por snooze (manual) e nag (automático): mesma dose, mesma
// tolerância dinâmica, mesmo payload de re-registro. Extraído pra manter
// handleAlarmAction abaixo do teto de complexidade (R-? lint).
function rescheduleBase(data) {
  const { doseInstanceId, toleranceMinutes, isCritical } = data
  const isCrit = isCritical === 'true' || isCritical === true
  return {
    doseInstanceId,
    medicineName: data.medicineName || '',
    scheduledFor: data.scheduledFor,
    toleranceMinutes: toleranceMinutes != null ? Number(toleranceMinutes) : null,
    isCritical: isCrit,
    data: { ...data },
  }
}

export async function handleAlarmAction(event) {
  const notification = event?.detail?.notification
  const pressActionId = event?.detail?.pressAction?.id
  const data = notification?.data || {}

  if (!data.doseInstanceId) return { handled: false }

  switch (pressActionId) {
    case ALARM_ACTION.TAKEN: {
      await registerTaken(data)
      return { handled: true, action: ALARM_ACTION.TAKEN }
    }

    case ALARM_ACTION.SKIP: {
      await registerSkip(data)
      return { handled: true, action: ALARM_ACTION.SKIP }
    }

    case ALARM_ACTION.SNOOZE: {
      await alarmService.scheduleSnooze({
        ...rescheduleBase(data),
        currentSnoozeAttempt: parseInt(data.snoozeAttempt || '0', 10),
      })
      return { handled: true, action: ALARM_ACTION.SNOOZE }
    }

    default: {
      // Sem ação explícita (descartada/ignorada) → nag reativo dentro da tolerância.
      await alarmService.scheduleNag({
        ...rescheduleBase(data),
        currentNagAttempt: parseInt(data.nagAttempt || '0', 10),
      })
      return { handled: true, action: 'nag' }
    }
  }
}
