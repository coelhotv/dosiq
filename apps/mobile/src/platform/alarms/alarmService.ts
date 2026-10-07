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
import * as Notifications from 'expo-notifications'
import { colors } from '@shared/styles/tokens'
import { debugLog } from '@shared/utils/debugLog'
import { logEvent } from '@platform/analytics/productAnalytics'
import { EVENTS } from '@platform/analytics/analyticsEvents'

// Canal Android é IMUTÁVEL após criado — bumpar o id força recriação com o som
// correto (alarm_dose). v1 ficou no som padrão; v2 nasceu padrão em devices cujo
// build era anterior ao plugin de sons (res/raw sem alarm_dose) e, por ser
// imutável, não corrigia nem reinstalando. v3 = canal limpo no build COM o som.
// 062 (D-2): no Android este canal MORREU (nenhum alarme o usa desde a spec 010) e entra na varredura
// de legados. O id segue vivo só como CATEGORIA iOS (`ensureAlarmCategories`, `ios.categoryId`).
export const ALARM_CHANNEL_ID = 'dose-alarm-v3'
// Canal Android ÚNICO do alarme (062 D-1/D-2). `-v3` nasce pelo expo-notifications porque só ele expõe
// `audioAttributes.usage = ALARM` (volume de alarme; toca no vibrar/mute no AOSP — medido F0). O
// notifee segue EXIBINDO nele. REGRA (R-261 + F0/Q5): canal é imutável e um id deletado RESSUSCITA a
// config antiga se recriado — mudar a config exige id NUNCA usado, jamais reaproveitar um legado.
export const ALARM_CRITICAL_CHANNEL_ID = 'dose-alarm-critical-v3'
// Antecessor do `-v3` (USAGE_NOTIFICATION, criado pelo notifee). Segue sendo o canal de FALLBACK
// quando o expo falha (E-2): recriá-lo com a config de sempre é no-op no device que já o tem.
export const LEGACY_CRITICAL_CHANNEL_ID = 'dose-alarm-critical-v2'
// Lista FECHADA (nunca prefixo/regex — PO-16): canais de alarme de versões anteriores. Usada pelo
// predicado `isAlarmNotification` (alarme agendado pela versão antiga ou no fallback).
export const LEGACY_ALARM_CHANNEL_IDS: readonly string[] = Object.freeze([
  LEGACY_CRITICAL_CHANNEL_ID,
  'dose-alarm-critical-v1',
  ALARM_CHANNEL_ID,
  'dose-alarm-v2', // nunca existiu em código (só num mock) — delete de id inexistente é no-op (medido)
  'dose-alarm', // o original sem sufixo (Spec 001, 2026-06-02 → trocado por dose-alarm-v3 em 06-03)
])
// Varredura = alarme ∪ superfície 039 antiga (RC3 E-3: `dose-activity-v1` NÃO é alarme).
export const LEGACY_SWEEP_CHANNEL_IDS: readonly string[] = Object.freeze([...LEGACY_ALARM_CHANNEL_IDS, 'dose-activity-v1'])
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

let criticalChannelEnsured = false
let legacyChannelsMigrated = false

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
 * Garante a infra do alarme pra plataforma atual: canal no Android, categoria de ações no iOS.
 * Chamado antes de todo agendamento (inclusive soneca/nag headless — por isso NÃO migra canais).
 */
export async function ensureAlarmSetup() {
  await ensureAlarmCriticalChannel()
  await ensureAlarmCategories()
}

/**
 * Canal Android do alarme (062 D-1). Cria o `-v3` pelo expo-notifications; a flag só vira true no
 * sucesso, então o próximo setup re-tenta. Falhou ⇒ garante o `-v2` (notifee, config de sempre) e o
 * alarme vai nele — fail-open = o alarme AINDA TOCA (FR-006/E-2). Nunca criar o `-v3` pelo notifee:
 * queimaria o id sem USAGE_ALARM (F0/Q5).
 * @returns {Promise<boolean>} true se o `-v3` está garantido neste processo
 */
export async function ensureAlarmCriticalChannel() {
  if (Platform.OS !== 'android') return false
  if (criticalChannelEnsured) return true
  try {
    await Notifications.setNotificationChannelAsync(ALARM_CRITICAL_CHANNEL_ID, {
      name: 'Alarmes críticos de dose',
      importance: Notifications.AndroidImportance.HIGH,
      sound: SOUND_IOS, // expo resolve res/raw pelo nome com extensão (padrão ensurePushChannel)
      enableVibrate: true,
      bypassDnd: true, // só vale se o acesso ao DND existir NA CRIAÇÃO (F0/Q3) — custo zero
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    })
    criticalChannelEnsured = true
    return true
  } catch (err) {
    // Sinal channel_v3_failed: em prod, o beacon lê `getChannel(-v3)` nulo ⇒ importance null.
    if (__DEV__) console.warn('[alarmService] channel_v3_failed', err?.message)
    await ensureLegacyCriticalChannel()
    return false
  }
}

/** Fallback E-2: o `-v2` com a config de sempre (recriar o mesmo id com a mesma config é no-op). */
async function ensureLegacyCriticalChannel() {
  await notifee.createChannel({
    id: LEGACY_CRITICAL_CHANNEL_ID,
    name: 'Alarmes críticos de dose',
    importance: AndroidImportance.HIGH,
    sound: SOUND_ANDROID,
    vibration: true,
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  })
}

/** Canal em que o alarme Android é postado: o `-v3` se garantido, senão o fallback `-v2`. */
export function resolveAlarmChannelId() {
  return criticalChannelEnsured ? ALARM_CRITICAL_CHANNEL_ID : LEGACY_CRITICAL_CHANNEL_ID
}

/** Ids referenciados por notificação exibida OU trigger pendente (o item do notifee traz `.notification`). */
function _referencedChannelIds(items) {
  const ids = new Set<string>()
  for (const item of items) {
    const channelId = (item?.notification || item)?.android?.channelId
    if (channelId) ids.add(channelId)
  }
  return ids
}

/**
 * 062 D-3 — apaga os canais legados (lista fechada) da base instalada. SÓ pode ser chamada depois de
 * `cancelAll` + re-agendamento (fim do `syncAlarms`): aí nenhum trigger da versão antiga sobrou no
 * `-v2` (RC3 E-1). Mesmo assim pula id com notificação exibida (deletar derruba o alarme em curso —
 * F0/Q7) ou trigger pendente. Leitura falha ⇒ não deleta nada. Nunca lança (FR-005/006).
 * A flag só marca varredura LIMPA (E-4): id pulado/falho ⇒ a próxima chamada tenta de novo.
 */
export async function migrateLegacyAlarmChannels() {
  if (Platform.OS !== 'android' || legacyChannelsMigrated) return
  // C-1: sem dose crítica nas 72h o syncAlarms não agenda nada e o -v3 nunca seria garantido.
  // try/catch próprio (RC6 #867): -v3 e fallback -v2 falhando juntos lançam do ensure — aqui isso só
  // significa "não migra", nunca erro para o caller (FR-005/006).
  let ensured = false
  try {
    ensured = await ensureAlarmCriticalChannel()
  } catch {
    return
  }
  if (!ensured) return
  let referenced: Set<string>
  try {
    const [displayed, triggers] = await Promise.all([
      notifee.getDisplayedNotifications(),
      notifee.getTriggerNotifications(),
    ])
    referenced = _referencedChannelIds([...(displayed || []), ...(triggers || [])])
  } catch {
    return
  }
  let clean = true
  for (const id of LEGACY_SWEEP_CHANNEL_IDS) {
    if (referenced.has(id)) {
      clean = false
      continue
    }
    try {
      await notifee.deleteChannel(id)
    } catch {
      clean = false
    }
  }
  legacyChannelsMigrated = clean
  debugLog('[alarmService] migração de canais legados', clean ? 'completa' : 'parcial')
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
// isCritical: só o iOS diferencia. Android = canal único resolvido (062 D-2); deve rodar após ensureAlarmSetup.
function buildNotification({ doseInstanceId, medicineName, data, notificationId }: { doseInstanceId: string, medicineName?: string, data?: Record<string, unknown>, notificationId: string, isCritical?: boolean }) {
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
      channelId: resolveAlarmChannelId(),
      // 062 D-7: a marca do dosiq (drawable escrito por withDoseActivityAndroidIcon.js), igual à
      // superfície e ao push — sem isto cai no launcher mascarado.
      smallIcon: 'ic_dosiq_mark',
      color: colors.brand.primary,
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

// 065 AD-8: payload do `dose_snoozed` — chave ausente fica fora (A-1). Extraído p/ manter
// `scheduleSnooze` sob o teto de complexidade do lint. @private
function _emitSnoozed(source, surface) {
  const props: Record<string, string> = {}
  if (source) props.source = source
  if (surface) props.surface = surface
  logEvent(EVENTS.DOSE_SNOOZED, props)
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
  // 065 AD-8: origem do aviso (REMINDER_SOURCES) e canal do toque (SURFACES). SEM default (A-1):
  // chamador que não informa manda o evento sem a chave.
  source = null as string | null,
  surface = null as string | null,
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
  // 🔴 CONTRATO (082 D1): o servidor trata este `snoozed` como PROVA de que o alarme da soneca está
  // armado e suprime o push crítico por ela (`doseReminders._isDoseCovered`). Ele DEVE continuar
  // depois do `createTriggerNotification` acima — travado em `alarmService.snoozeWindow.test.ts`.
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

  // 065 AD-8: `dose_snoozed` só quando a soneca FOI agendada (recusa fora da janela e teto estourado
  // saem antes). 1 por ação, não por ocorrência agrupada. Fail-silent (CON-021).
  _emitSnoozed(source, surface)

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
  ensureAlarmCriticalChannel,
  resolveAlarmChannelId,
  migrateLegacyAlarmChannels,
  ensureAlarmCategories,
  ensureAlarmSetup,
  scheduleAlarm,
  cancelAlarm,
  scheduleNag,
  scheduleSnooze,
  cancelAll,
}
