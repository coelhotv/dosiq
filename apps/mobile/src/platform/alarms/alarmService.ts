// alarmService.js — orquestra alarmes locais persistentes via Notifee (Spec 001)
//
// Coexiste com expo-notifications (push remoto, push_chime.wav). Este módulo cuida
// SÓ do alarme invasivo local (alarm_dose.wav, canal HIGH, bypass DND, full-screen).
//
// Invariantes:
//  - F: `scheduledFor` é instante absoluto (ISO/timestamptz) → TriggerType.TIMESTAMP
//       usa o instante direto, SEM conversão de timezone no agendamento.
//  - A: notificationId === doseInstanceId → idempotência cross-restart (re-sync
//       re-cria a MESMA id; o SO substitui em vez de duplicar).
//  - D: nag/expiração respeitam `toleranceMinutes` da própria instância (dinâmico),
//       nunca 120 fixo.
//  - cancelAll usa cancelTriggerNotifications() → cancela só triggers do Notifee,
//       NÃO toca as notificações do expo-notifications (push remoto preservado).

import { createDoseInstanceRepository, createCriticalAuditService, parseISO, formatConcentration, getRawNow } from '@dosiq/core'
// 067 A2: guarda bilateral de janela + trilha/aviso da anomalia. O `triggerAlarmResync` corrige o
// agendamento a partir do banco quando a soneca recai sobre um disparo torto (FR-006).
import { evaluateDoseWindow } from './doseWindow'
import { reportOutOfWindowAlarm } from './outOfWindowNotice'
import { triggerAlarmResync } from './alarmResyncBus'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  TriggerType,
  AuthorizationStatus,
} from '@notifee/react-native'
import { Platform, Linking } from 'react-native'
import * as Device from 'expo-device'
import { debugLog } from '@shared/utils/debugLog'

// Canal Android é IMUTÁVEL após criado — bumpar o id força recriação com o som
// correto (alarm_dose). v1 ficou no som padrão; v2 nasceu padrão em devices cujo
// build era anterior ao plugin de sons (res/raw sem alarm_dose) e, por ser
// imutável, não corrigia nem reinstalando. v3 = canal limpo no build COM o som.
// REGRA: ao trocar o som do alarme, SEMPRE bumpar este id (senão fica no antigo).
export const ALARM_CHANNEL_ID = 'dose-alarm-v3'
// Canal crítico Android (Spec 010, R-261): id separado para alarmes críticos (critical_alarm=true).
// NUNCA mudar o id dose-alarm-v3 acima; bumpar este ao trocar som do canal crítico.
export const ALARM_CRITICAL_CHANNEL_ID = 'dose-alarm-critical-v2'
const SOUND_ANDROID = 'alarm_dose' // res/raw/alarm_dose (sem extensão)
const SOUND_IOS = 'alarm_dose.wav'
// iOS interruption level (T013). 'timeSensitive' fura Focus/DND e é auto-concedido.
// Promover a 'critical' (fura mute físico/silencioso total) SÓ após a Apple aprovar
// o entitlement com.apple.developer.usernotifications.critical-alerts (formulário
// em avaliação). Ao promover: trocar aqui + add `critical:true` no bloco ios do
// buildNotification + declarar o entitlement no app.config/ios entitlements.
const IOS_INTERRUPTION_LEVEL = 'timeSensitive' as const
const NAG_INTERVAL_MS = 5 * 60 * 1000
const MAX_NAG_ATTEMPTS = 3
const SNOOZE_INTERVAL_MS = 5 * 60 * 1000 // soneca manual = +5min
const MAX_SNOOZE_ATTEMPTS = 3

// Auditoria de dose crítica (spec 042). getUserId resolve o usuário logado a partir
// da sessão persistida (AsyncStorage) — funciona também no handler headless do Android.
// Retorna null se não houver sessão → o service trata como evento órfão (não insere).
const snoozeAudit = createCriticalAuditService({
  client: supabase as any,
  getUserId: async () => {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  },
})

// Ações da notificação (R-222 — IDs estáveis, sem string solta no caller).
export const ALARM_ACTION = Object.freeze({
  TAKEN: 'dose-taken',
  SKIP: 'dose-skip',
  SNOOZE: 'dose-snooze',
})

let channelEnsured = false
let criticalChannelEnsured = false

/**
 * Pede a permissão de notificação do SO (POST_NOTIFICATIONS no Android 13+,
 * autorização no iOS). É a MESMA permissão do push — alarme e push a compartilham.
 * Ponto de intenção: ligar o toggle do alarme (R-239).
 * @returns {Promise<boolean>} concedida (AUTHORIZED ou PROVISIONAL)
 */
export async function requestAlarmPermission() {
  try {
    const settings = await notifee.requestPermission()
    return (
      settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
      settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
    )
  } catch {
    return false
  }
}

/**
 * Android 14+ (API 34): `USE_FULL_SCREEN_INTENT` virou acesso especial — declarar
 * no manifest não basta, o SO rebaixa pra heads-up até o usuário conceder. Não há
 * API pra checar/conceder programaticamente; abre a tela de configuração do SO.
 * No-op em < API 34 (concedida por declaração) e no iOS.
 * @returns {Promise<boolean>} true se precisou abrir as configs (API ≥ 34)
 */
export async function openFullScreenIntentSettings() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 34) return false
  try {
    // Action global de "Notificações em tela cheia" (lista de apps).
    await Linking.sendIntent('android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT')
  } catch {
    try {
      await Linking.openSettings() // fallback: detalhes do app
    } catch {
      // best-effort
    }
  }
  return true
}

/** True se o aparelho exige o acesso especial de full-screen (Android 14+). */
export function needsFullScreenIntentAccess() {
  return Platform.OS === 'android' && Number(Platform.Version) >= 34
}

/**
 * True em aparelhos Xiaomi/Redmi/POCO (HyperOS/MIUI) — restringem alarme em
 * background de forma agressiva (autostart, bateria, lock-screen, pop-up) e
 * precisam de um guia próprio, mais detalhado, vs. o genérico do Android 14+.
 */
export function isXiaomiDevice() {
  if (Platform.OS !== 'android') return false
  const id = `${Device.manufacturer || ''} ${Device.brand || ''}`.toLowerCase()
  return /xiaomi|redmi|poco/.test(id)
}

let iosCategoriesEnsured = false

/**
 * iOS: registra a categoria de notificação com as ações Tomei/Soneca/Pular
 * (T015). Sem isso a notif iOS sai SEM botões — `categoryId` no payload só
 * referencia uma categoria que precisa existir. Idempotente. No-op no Android.
 * `foreground:false` → ação tratada pelo background handler (igual Android),
 * sem abrir o app; só o tap no corpo abre (AlarmFullScreen).
 */
export async function ensureAlarmCategories() {
  if (Platform.OS !== 'ios' || iosCategoriesEnsured) return
  await notifee.setNotificationCategories([
    {
      id: ALARM_CHANNEL_ID,
      actions: [
        { id: ALARM_ACTION.TAKEN, title: 'Tomei', foreground: false },
        { id: ALARM_ACTION.SNOOZE, title: 'Soneca 5 min', foreground: false },
        { id: ALARM_ACTION.SKIP, title: 'Pular', foreground: false, destructive: true },
      ],
    },
  ])
  iosCategoriesEnsured = true
}

/**
 * Garante a infra do alarme pra plataforma atual: canal HIGH no Android,
 * categoria de ações no iOS. Chamado antes de todo agendamento.
 */
export async function ensureAlarmSetup() {
  await ensureAlarmChannel()
  await ensureAlarmCriticalChannel()
  await ensureAlarmCategories()
}

/** Cria (idempotente) o canal Android HIGH que fura DND. No-op no iOS. */
export async function ensureAlarmChannel() {
  if (Platform.OS !== 'android' || channelEnsured) return
  await notifee.createChannel({
    id: ALARM_CHANNEL_ID,
    name: 'Alarmes de dose',
    importance: AndroidImportance.HIGH,
    sound: SOUND_ANDROID,
    vibration: true,
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  })
  channelEnsured = true
}

/** Canal Android crítico (dose-alarm-critical-v1) — para alarmes com critical_alarm=true. No-op no iOS. */
export async function ensureAlarmCriticalChannel() {
  if (Platform.OS !== 'android' || criticalChannelEnsured) return
  await notifee.createChannel({
    id: ALARM_CRITICAL_CHANNEL_ID,
    name: 'Alarmes críticos de dose',
    importance: AndroidImportance.HIGH,
    sound: SOUND_ANDROID,
    vibration: true,
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  })
  criticalChannelEnsured = true
}

function _getSingleDoseDesc(name, dosagePerPill, dosageUnit, quantity) {
  const dosageInfo = dosagePerPill && dosageUnit ? ` (${formatConcentration(dosagePerPill, dosageUnit)})` : ''
  const intakeInfo = ` • ${quantity ?? '1'} un.`
  return `${name}${dosageInfo}${intakeInfo}`
}

function _getGroupedAlarmCopy(doses, time) {
  if (doses.length === 0) {
    return {
      title: '💊 Hora da dose',
      body: 'Está na hora do seu remédio.',
    }
  }

  if (doses.length === 1) {
    const d = doses[0]
    const desc = _getSingleDoseDesc(d.medicineName, d.dosagePerPill, d.dosageUnit, d.dosagePerIntake)
    return {
      title: '💊 Remédio essencial',
      body: `Hora de tomar ${desc}${time ? ` — ${time}` : ''}.`,
    }
  }

  const firstPlan = doses[0].treatmentPlanName
  const samePlan = firstPlan && doses.every((d) => d.treatmentPlanName === firstPlan)

  if (samePlan) {
    return {
      title: '📂 Plano essencial',
      body: `Hora dos remédios do plano ${firstPlan}${time ? ` — ${time}` : ''}.`,
    }
  }

  return {
    title: '📋 Doses essenciais',
    body: `Doses pendentes para as ${time || ''}.`,
  }
}

function _getSingleAlarmCopy(medicineName, data, time) {
  const name = medicineName || data?.medicineName || 'sua dose'
  const desc = _getSingleDoseDesc(name, data?.dosagePerPill, data?.dosageUnit, data?.quantityTaken)
  return {
    title: '💊 Remédio essencial',
    body: `Hora de tomar ${desc}${time ? ` — ${time}` : ''}.`,
  }
}

// Monta o copy clínico customizado e acolhedor dos alarmes
function getAlarmCopy({ medicineName, data }) {
  const time = data?.scheduledTime
  const isGrouped = data?.isGrouped === 'true'

  if (isGrouped) {
    let doses = []
    try {
      doses = JSON.parse(data.groupedDoses || '[]')
    } catch {
      // fallback
    }

    return _getGroupedAlarmCopy(doses, time)
  }

  return _getSingleAlarmCopy(medicineName, data, time)
}

// Monta o objeto de notificação compartilhado por agendamento e nag.
// isCritical=true: iOS fura modo silencioso (entitlement critical-alerts); Android: canal crítico dedicado.
function buildNotification({ doseInstanceId, medicineName, data, notificationId, isCritical = false }) {
  const { title, body } = getAlarmCopy({ medicineName, data })
  const sanitizedData: Record<string, string> = {}
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        sanitizedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value)
      }
    }
  }
  sanitizedData.doseInstanceId = String(doseInstanceId)

  return {
    id: notificationId,
    title,
    body,
    data: sanitizedData,
    android: {
      channelId: isCritical ? ALARM_CRITICAL_CHANNEL_ID : ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      sound: SOUND_ANDROID,
      // Loop do som + notif persistente: toca até o usuário escolher Tomei/Pular.
      // ongoing+autoCancel:false impedem swipe/auto-dismiss; cancelAlarm para o som.
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      // Full-screen intent na lock screen (FR-002).
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: 'Tomei', pressAction: { id: ALARM_ACTION.TAKEN } },
        { title: 'Soneca', pressAction: { id: ALARM_ACTION.SNOOZE } },
        { title: 'Pular', pressAction: { id: ALARM_ACTION.SKIP } },
      ],
    },
    ios: {
      sound: SOUND_IOS,
      // Temporariamente forçando timeSensitive para critical_alarm enquanto o entitlement
      // com.apple.developer.usernotifications.critical-alerts está em aprovação pela Apple.
      // Com 'critical', se o entitlement não estiver presente no profile de provisionamento,
      // o iOS rejeita a notificação inteira silenciosamente.
      interruptionLevel: IOS_INTERRUPTION_LEVEL,
      // critical: true, // Desativado até obter o entitlement
      categoryId: ALARM_CHANNEL_ID, // ações registradas em ensureAlarmCategories (T015)
      // iOS suprime som/banner de notif quando o app está em foreground por padrão.
      // Declarar pra o alarme tocar/aparecer mesmo com o app aberto (paridade Android).
      foregroundPresentationOptions: { sound: true, banner: true, list: true },
    },
  }
}

/**
 * Agenda o alarme de uma ocorrência. Idempotente por `doseInstanceId` (A).
 * `fireAt` (epoch ms, opcional) sobrescreve QUANDO dispara mantendo `scheduledFor` p/
 * tolerância/labels — usado p/ re-armar soneca após resync (snoozed_until), já que
 * `cancelAll` mata o trigger de soneca e o item snoozed sairia sem re-agendamento.
 * @param {{ doseInstanceId: string, medicineName?: string, scheduledFor: string|number|Date,
 *           toleranceMinutes?: number|null, earlyWindowMinutes?: number|null, isCritical?: boolean,
 *           data?: object, fireAt?: number|null }} params
 */
interface ScheduleAlarmParams {
  doseInstanceId: string
  medicineName?: string
  scheduledFor: string | number | Date
  toleranceMinutes?: number | null
  /**
   * 067 A2 (FR-024): PISO da janela, lido de `dose_instances.early_window_minutes` e carregado no
   * payload para a guarda poder decidir NO DISPARO, sem rede e sem re-derivar o intervalo.
   * `null` ⇒ o client aplica 120 fail-closed (FR-032).
   */
  earlyWindowMinutes?: number | null
  isCritical?: boolean
  data?: Record<string, unknown>
  fireAt?: number | null
}

export async function scheduleAlarm({
  doseInstanceId,
  medicineName,
  scheduledFor,
  toleranceMinutes = null,
  earlyWindowMinutes = null,
  isCritical = false,
  data = {},
  fireAt = null,
}: ScheduleAlarmParams) {
  await ensureAlarmSetup()
  // F: instante absoluto (timestamptz) → epoch direto via parseISO (não date-string parse).
  // fireAt (epoch ms) tem precedência: re-arma a MESMA dose num horário deslocado (soneca).
  const timestamp = fireAt != null ? fireAt : parseISO(scheduledFor).getTime()
  if (Number.isNaN(timestamp)) {
    if (__DEV__) console.warn('[alarmService] scheduledFor inválido:', scheduledFor)
    return
  }
  // Não agendar passado: o gerador não cria pending retroativo; defensivo.
  if (timestamp <= Date.now()) return

  const notification = buildNotification({
    doseInstanceId,
    medicineName,
    notificationId: doseInstanceId,
    isCritical,
    data: { ...data, medicineName, scheduledFor, toleranceMinutes, earlyWindowMinutes, isCritical, nagAttempt: '0', snoozeAttempt: '0' },
  })

  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp,
    alarmManager: { allowWhileIdle: true }, // fura Doze Mode (Android)
  })
  debugLog('[alarmService] agendado', doseInstanceId, 'ts=', timestamp)
}

/**
 * Cancela o alarme de uma ocorrência: trigger pendente + notif JÁ EXIBIDA + nags.
 * cancelNotification para o loop do som (loopSound/ongoing) da notif disparada;
 * cancelTriggerNotification limpa o trigger que ainda não disparou. Os dois são
 * necessários — Tomei/Pular/Soneca dependem disto pra silenciar o alarme.
 */
export async function cancelAlarm(doseInstanceId) {
  await notifee.cancelNotification(doseInstanceId) // displayed (para o som em loop)
  await notifee.cancelTriggerNotification(doseInstanceId) // trigger pendente
  for (let n = 1; n <= MAX_NAG_ATTEMPTS; n++) {
    await notifee.cancelNotification(`${doseInstanceId}:nag:${n}`)
    await notifee.cancelTriggerNotification(`${doseInstanceId}:nag:${n}`)
  }
}

/**
 * Re-agenda um nag +5min se ignorado, máx 3 tentativas, reativamente (FR-003).
 * Respeita a tolerância da instância (D): além da janela, para de insistir.
 * @param {{ doseInstanceId: string, medicineName?: string, scheduledFor?: string|number|Date,
 *           toleranceMinutes?: number|null, currentNagAttempt?: number, isCritical?: boolean, data?: object }} params
 */
interface ScheduleNagParams {
  doseInstanceId: string
  medicineName?: string
  scheduledFor?: string | number | Date
  toleranceMinutes?: number | null
  currentNagAttempt?: number
  isCritical?: boolean
  data?: Record<string, unknown>
}

export async function scheduleNag({
  doseInstanceId,
  medicineName,
  scheduledFor,
  toleranceMinutes = null,
  currentNagAttempt = 0,
  isCritical = false,
  data = {},
}: ScheduleNagParams) {
  const next = currentNagAttempt + 1
  if (next > MAX_NAG_ATTEMPTS) return

  const nextTs = Date.now() + NAG_INTERVAL_MS

  // D: se a ocorrência já passou da tolerância, não insistir (vira missed pelo sweep).
  if (scheduledFor != null && toleranceMinutes != null) {
    const cutoff = parseISO(scheduledFor).getTime() + toleranceMinutes * 60 * 1000
    if (!Number.isNaN(cutoff) && nextTs > cutoff) return
  }

  await ensureAlarmSetup()
  const notification = buildNotification({
    doseInstanceId,
    medicineName,
    notificationId: `${doseInstanceId}:nag:${next}`,
    isCritical,
    data: { ...data, medicineName, scheduledFor, toleranceMinutes, isCritical, nagAttempt: String(next) },
  })

  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp: nextTs,
    alarmManager: { allowWhileIdle: true },
  })
  debugLog('[alarmService] nag', next, doseInstanceId)
}

/**
 * Ids afetados pela soneca: o alarme agrupado carrega N ocorrências num payload só, e a soneca vale
 * para o grupo inteiro (o usuário adiou "as doses das 08:00", não uma delas).
 * Extraído p/ manter `scheduleSnooze` sob o teto de complexidade do lint. @private
 */
function _resolveSnoozedIds(doseInstanceId, data) {
  if (data?.isGrouped === 'true' && data?.doseInstanceIds) return data.doseInstanceIds.split(',')
  return [doseInstanceId]
}

/**
 * 067 A2 (FR-006 / US3) — a soneca não pode PROPAGAR um disparo torto.
 *
 * No incidente, `snoozed` às 09:47 foi seguido de `alarm_fired` às 09:52: a soneca reagenda +5min a
 * partir do DISPARO, não do horário real da dose, então repetia o erro em vez de corrigi-lo. Pior:
 * persistia `snoozed_until`, e com isso o próximo `syncAlarms` respeitava a soneca errada e não
 * re-armava o alarme das 13:30.
 *
 * Fora da janela: o alarme já foi cancelado pelo caller, aqui só NÃO persistimos `snoozed_until`,
 * registramos a anomalia (fail-open) e pedimos resync a partir do banco — a fonte da verdade.
 *
 * Soneca legítima nunca cai neste ramo: com `snoozeAttempt > 0` o disparo é DEPOIS de
 * `scheduled_for` por construção, e o piso só olha o lado adiantado.
 *
 * Extraído de `scheduleSnooze` p/ manter a função sob o teto de complexidade do lint. @private
 */
function _refuseSnoozeOutOfWindow({ doseInstanceId, medicineName, scheduledFor, toleranceMinutes, earlyWindowMinutes, data }) {
  const verdict = evaluateDoseWindow(
    { scheduledFor, toleranceMinutes, earlyWindowMinutes, ...data },
    getRawNow()
  )
  // Só o lado ADIANTADO: soneca de dose já vencida é inútil mas PRÉ-EXISTENTE, e o nag já para
  // sozinho além da tolerância. A anomalia que a US3 corrige é a soneca que PROPAGA um disparo
  // adiantado (09:47 → +5min, com a dose real às 13:30).
  if (!verdict.outOfWindow || verdict.direction !== 'early') return false
  reportOutOfWindowAlarm({
    data: { ...data, doseInstanceId, medicineName, scheduledFor },
    ...verdict,
  }).catch(() => {})
  triggerAlarmResync()
  return true
}

/**
 * Soneca manual (FR-003 v2): o usuário toca "Soneca" → re-agenda a MESMA dose pra
 * +5min, máx 3 vezes. Reusa o id da instância (substitui a notif atual e PARA o
 * loop do som). Diferente do nag (automático ao ignorar); aqui é ação consciente.
 * @returns {Promise<boolean>} true se re-agendou; false se estourou o teto.
 */
export async function scheduleSnooze({
  doseInstanceId,
  medicineName,
  scheduledFor,
  toleranceMinutes = null,
  earlyWindowMinutes = null,
  currentSnoozeAttempt = 0,
  isCritical = false,
  data = {} as Record<string, any>,
}) {
  // Cancela primeiro: mata o loop do som da notif atual.
  await cancelAlarm(doseInstanceId)

  // 067 A2 (FR-006 / US3): soneca sobre alarme FORA DA JANELA não reagenda — CORRIGE.
  if (_refuseSnoozeOutOfWindow({ doseInstanceId, medicineName, scheduledFor, toleranceMinutes, earlyWindowMinutes, data })) {
    return false
  }

  const next = currentSnoozeAttempt + 1
  if (next > MAX_SNOOZE_ATTEMPTS) return false

  await ensureAlarmSetup()
  const nextTs = Date.now() + SNOOZE_INTERVAL_MS
  const notification = buildNotification({
    doseInstanceId,
    medicineName,
    notificationId: doseInstanceId,
    isCritical,
    data: {
      ...data,
      medicineName,
      scheduledFor,
      toleranceMinutes,
      isCritical,
      nagAttempt: '0',
      snoozeAttempt: String(next),
    },
  })

  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp: nextTs,
    alarmManager: { allowWhileIdle: true },
  })

  // Persiste snoozed_until no DB para que syncAlarms não re-agende no próximo sync.
  const snoozedIds = _resolveSnoozedIds(doseInstanceId, data)
  try {
    const repo = createDoseInstanceRepository({ client: supabase as any })
    await Promise.all(snoozedIds.map((id) => repo.setSnoozedUntil(id, nextTs)))
  } catch (err) {
    if (__DEV__) console.warn('[alarmService] setSnoozedUntil falhou', doseInstanceId, err?.message)
  }

  // Auditoria de dose crítica (spec 042): emite `snoozed` por ocorrência. Fail-open
  // (o service nunca lança). isCritical filtra: só doses críticas geram trail (FR-004).
  if (isCritical) {
    // Emits independentes (1 por ocorrência) e fail-open (emit nunca rejeita) → paralelos.
    // Headless (onBackgroundEvent) tem orçamento de tempo limitado pelo SO: serial N inserts o queima.
    await Promise.all(
      snoozedIds.map((id) =>
        snoozeAudit.emit({
          doseInstanceId: id,
          event: 'snoozed',
          platform: Platform.OS,
          actor: 'user',
          detail: { snoozeAttempt: next },
        }),
      ),
    )
  }

  debugLog('[alarmService] snooze', next, doseInstanceId)
  return true
}

/** Cancela TODOS os triggers do Notifee (não toca expo-notifications). */
export async function cancelAll() {
  await notifee.cancelTriggerNotifications()
  debugLog('[alarmService] cancelAll')
}

export const alarmService = {
  requestAlarmPermission,
  openFullScreenIntentSettings,
  needsFullScreenIntentAccess,
  ensureAlarmChannel,
  ensureAlarmCriticalChannel,
  ensureAlarmCategories,
  ensureAlarmSetup,
  scheduleAlarm,
  cancelAlarm,
  scheduleNag,
  scheduleSnooze,
  cancelAll,
}
