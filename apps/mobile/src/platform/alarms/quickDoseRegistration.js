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
 * Processa o evento de ação do Notifee (foreground ou background handler).
 * @param {object} event - { type, detail: { notification, pressAction } }
 * @returns {Promise<{ handled: boolean, action?: string }>}
 */
export async function handleAlarmAction(event) {
  const notification = event?.detail?.notification
  const pressActionId = event?.detail?.pressAction?.id
  const data = notification?.data || {}
  const { doseInstanceId, protocolId, medicineId, quantityTaken, medicineName, toleranceMinutes } = data

  if (!doseInstanceId) return { handled: false }

  switch (pressActionId) {
    case ALARM_ACTION.TAKEN: {
      const quantity = Number(quantityTaken) || 1
      // VIA CANÔNICA — registerDose faz insert→consume_stock_fifo→âncora→rollback.
      await registerDose(
        {
          protocol_id: protocolId || null,
          medicine_id: medicineId,
          taken_at: getRawNow().toISOString(),
          quantity_taken: quantity,
        },
        { instanceId: doseInstanceId }
      )
      await alarmService.cancelAlarm(doseInstanceId)
      await invalidate(SNAPSHOTS_TAKEN)
      return { handled: true, action: ALARM_ACTION.TAKEN }
    }

    case ALARM_ACTION.SKIP: {
      // Skip não cria log nem consome estoque — update direto é correto aqui.
      await supabase.from('dose_instances').update({ status: 'skipped_user' }).eq('id', doseInstanceId)
      await alarmService.cancelAlarm(doseInstanceId)
      await invalidate(SNAPSHOTS_SKIP)
      return { handled: true, action: ALARM_ACTION.SKIP }
    }

    default: {
      // Sem ação explícita (descartada/ignorada) → nag reativo dentro da tolerância.
      await alarmService.scheduleNag({
        doseInstanceId,
        medicineName,
        scheduledFor: data.scheduledFor,
        toleranceMinutes: toleranceMinutes != null ? Number(toleranceMinutes) : null,
        currentNagAttempt: parseInt(data.nagAttempt || '0', 10),
        data: { protocolId, medicineId, quantityTaken },
      })
      return { handled: true, action: 'nag' }
    }
  }
}
