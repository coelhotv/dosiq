// devAlarmTriggers.js — gatilhos DEV-only pra smoke do Alarme Nativo (Spec 001).
//
// NÃO usar em produção. Constrói o MESMO payload do alarmService.buildNotification
// (título/corpo/som/ações/categoria) pra inspeção visual da notificação e do path
// full-screen sem esperar uma dose real. Usa um doseInstanceId sentinela —
// Tomei/Pular vão falhar no registro (id inexistente no DB) de propósito; o foco
// é a APRESENTAÇÃO (notif, botões, takeover, loop de som, soneca).

import notifee, {
  AndroidImportance,
  AndroidCategory,
  TriggerType,
} from '@notifee/react-native'
import {
  ALARM_CHANNEL_ID,
  ALARM_ACTION,
  ensureAlarmSetup,
} from '@platform/alarms/alarmService'
// R-020: instante SEMPRE via helpers do core — `new Date()` é barrado pelo lint de propósito.
import { getRawNow, parseISO } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { resetOutOfWindowNotices } from '@platform/alarms/outOfWindowNotice'

const DEV_INSTANCE_ID = 'dev-test-alarm'
const DEV_MEDICINE = 'Lantus'

// Espelha o bloco produzido por buildNotification (alarmService), simplificado.
// TODO(040-strict): payload notifee (Notification) não tipado (nível B)
function buildDevNotification(notificationId): any {
  return {
    id: notificationId,
    title: '💊 Hora da dose',
    body: `Está na hora de tomar ${DEV_MEDICINE} (12:00).`,
    data: {
      doseInstanceId: DEV_INSTANCE_ID,
      medicineName: DEV_MEDICINE,
      scheduledTime: '12:00',
      snoozeAttempt: '0',
      __dev: 'true',
    },
    android: {
      channelId: ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      sound: 'alarm_dose',
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Tomei', pressAction: { id: ALARM_ACTION.TAKEN } },
        { title: 'Soneca', pressAction: { id: ALARM_ACTION.SNOOZE } },
        { title: 'Pular', pressAction: { id: ALARM_ACTION.SKIP } },
      ],
    },
    ios: {
      sound: 'alarm_dose.wav',
      interruptionLevel: 'timeSensitive',
      categoryId: ALARM_CHANNEL_ID,
      foregroundPresentationOptions: { sound: true, banner: true, list: true },
    },
  }
}

// INVARIANTE A (alarmService): notificationId === doseInstanceId, senão
// cancelAlarm(doseInstanceId) não casa a notif exibida e o som não para.
/** Mostra a notificação NA HORA (visual rápido: notif + botões + som). */
export async function devFireAlarmNow() {
  await ensureAlarmSetup()
  await notifee.displayNotification(buildDevNotification(DEV_INSTANCE_ID))
}

/** Agenda pra +Ns (path real do trigger: Doze/lock → full-screen → ações). */
export async function devScheduleAlarmIn(seconds = 10) {
  await ensureAlarmSetup()
  await notifee.createTriggerNotification(buildDevNotification(DEV_INSTANCE_ID), {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + seconds * 1000,
    alarmManager: { allowWhileIdle: true },
  })
}

/** Limpa o alarme de teste pendente/exibido. */
export async function devClearAlarms() {
  await notifee.cancelNotification(DEV_INSTANCE_ID)
  await notifee.cancelTriggerNotification(DEV_INSTANCE_ID)
}

// ─────────────────────────────────────────────────────────────────────────────
// 067 A2 — gatilhos da GUARDA DE JANELA (smoke das PO-3/PO-15/PO-16)
//
// Por que gatilho novo em vez de reusar os de cima: os dois motivos que tornam os
// gatilhos originais cegos para a guarda —
//   1. eles mandam `__dev: 'true'`, e `registerTaken`/`registerSkip` curto-circuitam
//      nesse flag ANTES da guarda (de propósito: o smoke visual não deve tocar o DB);
//   2. eles não mandam `scheduledFor`, e sem horário a guarda não afirma nada
//      (comportamento correto — notificação sem horário não é evidência de nada).
// Estes gatilhos mandam `scheduledFor` no FUTURO e omitem `__dev`, então reproduzem
// exatamente o disparo torto do incidente de 2026-08-14.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ids sentinela da 1ª versão destes gatilhos — mantidos SÓ para a limpeza alcançar o que ficou
 * pendurado na gaveta de aparelhos que rodaram o smoke antes do fix.
 */
const LEGACY_SENTINEL_IDS = ['dev-early-alarm', 'dev-early-alarm-a', 'dev-early-alarm-b']
/** Piso de um protocolo 6/6h (gap 360 → 0,25 × 360 = 90) — fallback se a instância vier sem piso. */
const DEV_EARLY_WINDOW_MINUTES = 90

/**
 * 🔴 O id da dose TEM de ser uma instância REAL do banco.
 *
 * `dose_critical_events.dose_instance_id` é `uuid`: um sentinela tipo `'dev-early-alarm'` faz o
 * insert da trilha morrer em `22P02 invalid input syntax for type uuid` — e como a trilha é
 * fail-open (FR-008), a falha é SILENCIOSA. O smoke fica verde na tela (alarme cancelado + aviso
 * exibido) com a PO-3 nunca gravando nada. Foi o que aconteceu no smoke de 2026-08-17.
 *
 * Usar a instância real também é o único jeito de exercer o `isDoseResolved` (FR-039), que com id
 * inexistente sempre caía no default "avisar" sem consultar coisa alguma.
 */
/** Shape exato do SELECT abaixo — nomeado para o boundary do Supabase não entrar como `any`. */
type PendingInstanceRow = {
  id: string
  scheduled_for: string
  early_window_minutes: number | null
}

async function fetchRealPendingInstances(count: number): Promise<
  { id: string; scheduledFor: string; earlyWindowMinutes: number }[]
> {
  const { data, error } = await supabase
    .from('dose_instances')
    .select('id,scheduled_for,early_window_minutes')
    .eq('status', 'pending')
    .eq('critical_alarm', true)
    .gt('scheduled_for', getRawNow().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(count)
  if (error) throw new Error(`[devEarlyAlarm] falha ao buscar dose real: ${error.message}`)
  if (!data || data.length < count) {
    throw new Error(
      `[devEarlyAlarm] preciso de ${count} dose(s) pending crítica(s) no futuro, achei ${data?.length ?? 0}. ` +
        `Crie um tratamento crítico antes de rodar o smoke.`,
    )
  }
  return (data as PendingInstanceRow[]).map((row) => ({
    id: row.id,
    scheduledFor: row.scheduled_for,
    earlyWindowMinutes: row.early_window_minutes ?? DEV_EARLY_WINDOW_MINUTES,
  }))
}

// TODO(040-strict): payload notifee (Notification) não tipado (nível B)
function buildEarlyAlarmNotification(
  instanceId: string,
  scheduledFor: string,
  earlyWindowMinutes: number,
): any {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = parseISO(scheduledFor)
  return {
    id: instanceId,
    title: '💊 Hora da dose',
    body: `Está na hora de tomar ${DEV_MEDICINE} (${pad(d.getHours())}:${pad(d.getMinutes())}).`,
    data: {
      doseInstanceId: instanceId,
      medicineName: DEV_MEDICINE,
      scheduledFor,
      scheduledTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      toleranceMinutes: '120',
      earlyWindowMinutes: String(earlyWindowMinutes),
      isCritical: 'true',
      snoozeAttempt: '0',
      nagAttempt: '0',
      // SEM `__dev`: a guarda TEM de rodar. O registro é recusado por ela, não pelo flag —
      // é isso que o smoke precisa provar.
      __devEarly: 'true',
    },
    android: {
      channelId: ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      sound: 'alarm_dose',
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Tomei', pressAction: { id: ALARM_ACTION.TAKEN } },
        { title: 'Soneca', pressAction: { id: ALARM_ACTION.SNOOZE } },
        { title: 'Pular', pressAction: { id: ALARM_ACTION.SKIP } },
      ],
    },
    ios: {
      sound: 'alarm_dose.wav',
      interruptionLevel: 'timeSensitive',
      categoryId: ALARM_CHANNEL_ID,
      foregroundPresentationOptions: { sound: true, banner: true, list: true },
    },
  }
}

/**
 * Dispara UM alarme adiantado além do piso (PO-3/PO-15): a dose "é" daqui a 3h37, o alarme
 * toca agora. Esperado: takeover NÃO abre, alarme é cancelado, evento `alarm_out_of_window`
 * entra na trilha e o aviso informativo aparece (sem som, sem botão).
 */
export async function devFireEarlyAlarm() {
  const [dose] = await fetchRealPendingInstances(1)
  await fireEarlyFor(dose)
}

/** Ids já disparados nesta sessão — `devClearEarlyAlarms` precisa deles (agora são dinâmicos). */
const firedEarlyIds = new Set<string>()

/**
 * Dispara o alarme adiantado de UMA dose real, checando antes que o disparo de fato viola o piso.
 *
 * Sem essa checagem o smoke poderia rodar contra uma dose próxima (delta < piso), a guarda deixaria
 * passar CORRETAMENTE, e o resultado verde-em-tela seria lido como "guarda não funciona". @private
 */
async function fireEarlyFor(dose: { id: string; scheduledFor: string; earlyWindowMinutes: number }) {
  const aheadMinutes = Math.round(
    (parseISO(dose.scheduledFor).getTime() - getRawNow().getTime()) / 60000,
  )
  if (aheadMinutes <= dose.earlyWindowMinutes) {
    throw new Error(
      `[devEarlyAlarm] dose ${dose.id} está a ${aheadMinutes}min, dentro do piso de ` +
        `${dose.earlyWindowMinutes}min — este disparo NÃO seria fora de janela. Escolha outra dose.`,
    )
  }
  await ensureAlarmSetup()
  firedEarlyIds.add(dose.id)
  await notifee.displayNotification(
    buildEarlyAlarmNotification(dose.id, dose.scheduledFor, dose.earlyWindowMinutes),
  )
}

/**
 * Dispara 3x o MESMO alarme adiantado (PO-16): esperado 1 aviso informativo, não 3.
 * A trilha, ao contrário, registra os 3 — a recorrência é o que a US2 quer medir.
 */
export async function devFireEarlyAlarmBurst(times = 3) {
  const [dose] = await fetchRealPendingInstances(1)
  for (let i = 0; i < times; i++) {
    await fireEarlyFor(dose)
    await new Promise((r) => setTimeout(r, 1200))
  }
}

/**
 * Dispara alarmes adiantados de DUAS doses distintas (guard da PO-16): a coalescência é por
 * dose, então esperado 2 avisos — um por dose.
 */
export async function devFireEarlyAlarmTwoDoses() {
  const [a, b] = await fetchRealPendingInstances(2)
  await fireEarlyFor(a)
  await new Promise((r) => setTimeout(r, 1200))
  await fireEarlyFor(b)
}

/**
 * Limpa os alarmes adiantados de teste + os avisos informativos que eles geraram.
 *
 * Reseta TAMBÉM a coalescência em memória: sem isso o botão limpa a gaveta e deixa a dose marcada
 * como "já avisada", e a rodada seguinte da PO-16 mede 0 avisos em vez de 1 — parece supressão
 * correta, mas não prova nada sobre a rajada que se quer medir.
 */
export async function devClearEarlyAlarms() {
  resetOutOfWindowNotices()
  for (const id of [...firedEarlyIds, ...LEGACY_SENTINEL_IDS]) {
    await notifee.cancelNotification(id)
    await notifee.cancelTriggerNotification(id)
    await notifee.cancelNotification(`oow-${id}`) // aviso informativo (namespace `oow-`)
  }
}
