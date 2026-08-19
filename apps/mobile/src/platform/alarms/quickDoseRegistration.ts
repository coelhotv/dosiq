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
import { getRawNow, skipDose, isOutOfWindowError } from '@dosiq/core'
import { registerDose } from '@dose/services/doseService'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { alarmService, ALARM_ACTION } from './alarmService'
import { SURFACE_ACTION } from '@platform/doseActivity/doseActivitySurfaceService'
import { navigationRef } from '@navigation/navigationRef'
import { ROUTES } from '@navigation/routes'
import { evaluateDoseWindow } from './doseWindow'
import { reportOutOfWindowAlarm } from './outOfWindowNotice'
import { triggerAlarmResync } from './alarmResyncBus'

// Chaves reais verificadas no repo (mobile). Adesão = treatments-snapshot.
const SNAPSHOTS_TAKEN = ['@dosiq/today-snapshot', '@dosiq/stock-snapshot', '@dosiq/treatments-snapshot']
const SNAPSHOTS_SKIP = ['@dosiq/today-snapshot', '@dosiq/treatments-snapshot']

/** Dono da sessão — a RPC de skip exige `p_user_id` e valida a posse dentro dela (FR-028). */
async function resolveUserId() {
  const { data, error } = await supabase.auth.getUser()
  // AP-216: `{ data, error }` do supabase-js pode vir com `data.user` nulo sem `error`.
  if (error || !data?.user?.id) throw new Error('Sessão expirada. Entre novamente para pular a dose.')
  return data.user.id
}

async function invalidate(keys) {
  try {
    await AsyncStorage.multiRemove(keys)
  } catch {
    // best-effort — a UI re-busca na próxima abertura
  }
}

/**
 * 067 A2 (FR-005) — última barreira antes da escrita clínica.
 *
 * A guarda de `openAlarmScreen`/`pickPromotableAlarm` impede a tela cheia de abrir, mas as ações da
 * NOTIFICAÇÃO ("Tomei"/"Pular") não passam por lá: o handler do Notifee chama direto. Foi por esse
 * caminho que a dose de 13:30 virou `skipped_user` às 09:47. Recusar aqui cobre também o
 * `AlarmFullScreen`, que importa estas mesmas funções (RC3/F5 — funil único), sem guard duplicado.
 *
 * Vale para o LOTE inteiro no caso agrupado: meio registro é pior que nenhum, porque a paciente
 * acredita que o conjunto foi tratado.
 *
 * Cancela o alarme mesmo recusando (o som tem de parar — a paciente agiu) e nunca fica silencioso:
 * trilha + aviso informativo dizem o que aconteceu (Constituição §IX).
 *
 * @returns {{outOfWindow: boolean, result?: object}} `result` presente ⇒ o caller deve retorná-lo
 * @private
 */
async function refuseIfOutOfWindow(data, action) {
  const verdict = evaluateDoseWindow(data, getRawNow())
  // 🔴 SÓ o lado ADIANTADO recusa. Recusar o atrasado seria REGRESSÃO, não guarda:
  // `register_dose_atomic` aceita ancorar instância `missed` de propósito
  // (`status IN ('pending','missed','skipped_user')`), então tocar "Tomei" num alarme visto 3h
  // depois registra a dose hoje — e a paciente REALMENTE tomou. Bloquear isso deixaria uma dose
  // tomada fora do registro, que é o oposto do objetivo clínico desta spec.
  // O lado atrasado é tratado onde sempre foi: cancelamento da notificação vencida
  // (`reconcileStaleDoseNotifications`) e, no Slice B, pela regra do INSTANTE DECLARADO no banco
  // (FR-010/Decisão 2) — que distingue "editei o histórico" de "o alarme mentiu".
  if (!verdict.outOfWindow || verdict.direction !== 'early') return { outOfWindow: false }
  reportOutOfWindowAlarm({ data, ...verdict }).catch(() => {})
  if (__DEV__) {
    console.warn(
      `[quickDoseRegistration] ${action} recusado: dose fora da janela`,
      verdict.direction,
      verdict.deltaSeconds
    )
  }
  return {
    outOfWindow: true,
    result: {
      success: false,
      refused: 'out_of_window',
      direction: verdict.direction,
      // Motivo legível p/ quem exibe (AlarmFullScreen) — nunca "nada aconteceu" (Princípio IX).
      message:
        'Este alarme tocou fora do horário da dose. Nada foi registrado — vamos avisar de novo no horário certo.',
    },
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

  // 067 A2 (FR-005): fora da janela não vira registro clínico — vale p/ o lote no agrupado.
  const guard = await refuseIfOutOfWindow(data, 'registerTaken')
  if (guard.outOfWindow) return guard.result

  if (isGrouped === 'true' && groupedDoses) {
    let doses = []
    try {
      doses = JSON.parse(groupedDoses)
    } catch {
      // fallback
    }

    if (doses.length > 0) {
      for (const d of doses) {
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
      }
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
  // O card `done` (039) já é exibido por _cancelAlarmBestEffort dentro de registerDose (auto-gate
  // via readSurfaceLabel). Chamar showDoseDone aqui era redundante → IPC extra + flicker (#901).
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

  // 067 A2 (FR-005): o skip é a transição que destruiu a dose do incidente — grava fato clínico sem
  // declarar a que instante se refere (a fronteira que o Slice B fecha no banco). Aqui, no client, a
  // recusa fora da janela é o que impede um disparo torto de virar `skipped_user`.
  const guard = await refuseIfOutOfWindow(data, 'registerSkip')
  if (guard.outOfWindow) return guard.result

  let ids = [doseInstanceId]
  if (isGrouped === 'true' && groupedDoses) {
    let doses = []
    try {
      doses = JSON.parse(groupedDoses)
    } catch {
      // fallback: dose única (o id do grupo já está em `ids`)
    }
    // Lote all-or-nothing numa transação só — o `UPDATE ... .in(ids)` de antes já era atômico
    // e a RPC preserva isso (Decisão 14); um loop de N chamadas deixaria o grupo meio pulado.
    if (doses.length > 0) ids = doses.map((d) => d.instanceId).filter(Boolean)
  }

  // 067/B (FR-011/ADR-092): via RPC. O `UPDATE` cru daqui era a escrita que gravava fato
  // clínico sem declarar instante — agora `skippedAt` viaja e o banco recusa fora da janela,
  // mesmo que a guarda de client acima seja contornada (relógio adiantado).
  try {
    const userId = await resolveUserId()
    // 🔴 SEM `skippedAt`: o instante fica em branco de propósito para a RPC usar o `now()` do
    // SERVIDOR. Mandar o relógio do aparelho seria mandar exatamente o relógio que o incidente
    // provou não ser confiável — a guarda do banco existe justamente para não depender dele.
    await skipDose(supabase, { userId, instanceIds: ids })
  } catch (error) {
    // R-305/FR-013: recusa é BARULHENTA e chega legível à paciente — nunca "nada aconteceu".
    return {
      success: false,
      // `server_out_of_window` ≠ `out_of_window` (guarda de client, A2): distinguir é o que evita
      // avisar duas vezes — a recusa do client já emite o aviso próprio da FR-019.
      refused: isOutOfWindowError(error) ? 'server_out_of_window' : 'rejected',
      message: isOutOfWindowError(error)
        ? 'Este alarme tocou fora do horário da dose. Nada foi registrado — vamos avisar de novo no horário certo.'
        : String(error?.message || 'Não foi possível pular esta dose.'),
    }
  }

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
  const { doseInstanceId, toleranceMinutes, earlyWindowMinutes, isCritical } = data
  const isCrit = isCritical === 'true' || isCritical === true
  return {
    doseInstanceId,
    medicineName: data.medicineName || '',
    scheduledFor: data.scheduledFor,
    toleranceMinutes: toleranceMinutes != null ? Number(toleranceMinutes) : null,
    // 067 A2: soneca e nag herdam o piso — sem isto o re-agendamento perderia a guarda (FR-006).
    earlyWindowMinutes: earlyWindowMinutes != null ? Number(earlyWindowMinutes) : null,
    isCritical: isCrit,
    data: { ...data },
  }
}

// Normaliza a ação da superfície 039 → ação de alarme equivalente. "Adiar" da superfície
// compartilha a soneca canônica do alarme. ("Registrar" NÃO entra aqui — abre a modal bulk via
// navigateSurfaceRegister, tratado antes do switch.) Mantém o switch enxuto (complexity).
const SURFACE_TO_ALARM_ACTION = {
  [SURFACE_ACTION.SNOOZE]: ALARM_ACTION.SNOOZE,
}

// Monta o deeplink da modal bulk a partir do payload da superfície. Plano → 'bulk-plan'
// (modal multi-dose do tratamento); avulsa (sem treatmentId) → 'dose-individual'. `at` = HH:mm
// agendado (param `at` esperado por _resolveDeeplinkModal no TodayScreen). @private
function buildRegisterDeeplink(data) {
  const at = data.scheduledTime || ''
  if (data.treatmentId) {
    return { screen: 'bulk-plan', planId: data.treatmentId, at, treatmentPlanName: data.treatmentPlanName || data.medicineName || '' }
  }
  if (data.protocolId) {
    return { screen: 'dose-individual', protocolId: data.protocolId, at }
  }
  return {}
}

// "Registrar" da superfície 039 → abre o app na modal bulk (sítio de aplicação do injetável só
// é selecionável lá). launchActivity (na ação) traz o app ao foreground; aqui navegamos via
// navigationRef. Cold start: o container pode não ter montado → guard isReady() + retry curto
// (mesmo padrão de usePushNotifications.navigateFromPush). @private
function navigateSurfaceRegister(data) {
  const params = buildRegisterDeeplink(data)
  const go = () => navigationRef.navigate(ROUTES.TODAY, params)
  if (navigationRef.isReady?.()) {
    go()
    return
  }
  let waited = 0
  const interval = setInterval(() => {
    waited += 100
    if (navigationRef.isReady?.()) {
      clearInterval(interval)
      go()
    } else if (waited >= 5000) {
      clearInterval(interval)
    }
  }, 100)
}

/**
 * 067/B (FR-013 · Princípio IX): a recusa também tem de FALAR pelo caminho da NOTIFICAÇÃO.
 *
 * O handler do Notifee roda headless — não há tela para `Alert`, então o retorno de
 * `registerSkip`/`registerTaken` morria aqui em silêncio: o alarme sumia, nada era gravado, e a
 * paciente ficava achando que registrou. A recusa do A2 (client) já tinha voz pelo aviso da
 * FR-019; a recusa do BANCO (Slice B) não tinha nenhuma.
 *
 * Fail-open: não avisar é ruim, derrubar o handler é pior. @private
 */
async function reportRefusal(data, result) {
  if (!result || result.success !== false || !result.message) return
  // A recusa do CLIENT (A2) já emite o aviso próprio da FR-019 — não duplicar.
  if (result.refused === 'out_of_window') return
  try {
    const { showRefusalNotice } = require('./refusalNotice')
    await showRefusalNotice({ doseInstanceId: data?.doseInstanceId, message: String(result.message) })
  } catch {
    // best-effort
  }
}

// Despacha a ação canônica do alarme (Tomei/Pular/Soneca/nag). Extraído de handleAlarmAction
// p/ manter ambas sob o teto de complexidade. @private
async function dispatchCanonicalAction(pressActionId, data) {
  switch (pressActionId) {
    case ALARM_ACTION.TAKEN: {
      await reportRefusal(data, await registerTaken(data))
      return { handled: true, action: ALARM_ACTION.TAKEN }
    }

    case ALARM_ACTION.SKIP: {
      await reportRefusal(data, await registerSkip(data))
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
      // 🔴 FR-006 pelo caminho PASSIVO. O nag para no cutoff `scheduledFor + tolerance`; num disparo
      // ADIANTADO `now` está muito antes desse cutoff, então ignorar a notificação torta reagendava
      // nag após nag — o alarme errado voltava a incomodar em loop ATÉ a hora real da dose. As guardas
      // de ação e de takeover barram a escrita, mas não o incômodo: para a paciente, o defeito
      // continuava acontecendo. Aqui o disparo torto morre em vez de se reagendar, e o resync
      // reconstrói a agenda a partir do banco.
      const early = await refuseIfOutOfWindow(data, 'nag')
      if (early.outOfWindow) {
        triggerAlarmResync()
        return { handled: true, action: 'nag', refused: 'out_of_window' }
      }
      // Sem ação explícita (descartada/ignorada) → nag reativo dentro da tolerância.
      await alarmService.scheduleNag({
        ...rescheduleBase(data),
        currentNagAttempt: parseInt(data.nagAttempt || '0', 10),
      })
      return { handled: true, action: 'nag' }
    }
  }
}

export async function handleAlarmAction(event) {
  const notification = event?.detail?.notification
  const rawActionId = event?.detail?.pressAction?.id
  const data = notification?.data || {}

  if (!data.doseInstanceId) return { handled: false }

  // Superfície 039: "Registrar" NÃO registra silencioso — abre a modal bulk (sítio p/ injetável).
  if (rawActionId === SURFACE_ACTION.REGISTER) {
    navigateSurfaceRegister(data)
    return { handled: true, action: 'surface-open-register' }
  }

  const pressActionId = SURFACE_TO_ALARM_ACTION[rawActionId] ?? rawActionId
  return dispatchCanonicalAction(pressActionId, data)
}
