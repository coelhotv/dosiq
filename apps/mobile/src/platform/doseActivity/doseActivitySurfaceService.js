// doseActivitySurfaceService.js — superfície de estado contínuo Android (Spec 039 / F2)
//
// Promove o spike (devDoseActivitySpike) a produção. Renderiza UMA dose como ongoing
// notification "companheira" (canal DEFAULT, SEM som — SC-005), consumindo o núcleo
// `selectActiveDoseActivity` (CON-029). A máquina de estados vive no core; aqui só APRESENTA.
//
// Invariantes:
//  - Canal DEFAULT separado e imutável (R-261): `dose-activity-v1`. NUNCA tocar nos canais
//    de alarme (dose-alarm-v3/-critical-v2) — superfície ≠ alarme.
//  - Sem som / sem loop / sem full-screen (não é alarme). ongoing+autoCancel:false = persistente.
//  - Sem pressAction de corpo (sem launchActivity): tocar a notif NÃO abre o app — evita o
//    listener do expo (usePushNotifications) capturar o press e navegar 'Hoje' (AP-207).
//  - id estável = doseInstanceId → re-displayNotification nos boundaries substitui (não duplica).
//  - CL-1: Chronometer é display-only (não dispara no zero); transições vêm de re-display no
//    boundary, em piggyback nos triggers locais (bridge). CL-3: count-up só nas 1ªs ~2h.
//
// Cor = contrato de design §9.6 (decisões A/B). Constantes nomeadas centralizadas aqui (a cor
// do acento nativo é um hex de canal, não um token de StyleSheet RN — a regra "sem hex" vale
// p/ estilos de componente, não p/ o tint da notificação do SO).

import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native'
import { DOSE_ACTIVITY_STATES, daysAgoLabel, formatDoseItem, getRawNow, parseISO } from '@dosiq/core'
import { colors } from '@shared/styles/tokens'

export const DOSE_ACTIVITY_CHANNEL_ID = 'dose-activity-v1'

// id PRÓPRIO da superfície (distinto do alarme!). CRÍTICO: o alarme usa `doseInstanceId` como id de
// notificação/trigger; o Notifee só mantém 1 trigger PENDENTE por id. Se a superfície usar o mesmo id,
// seus boundaries (re-armados a cada foreground/60s) SOBRESCREVEM o trigger do alarme → o alarme NÃO
// dispara no T0 (bug smoke 2026-06-29). Sufixo separa os dois namespaces. data.doseInstanceId segue
// sendo o id REAL da dose (ações/registro/advance).
const SURFACE_ID_SUFFIX = ':surface'
export const surfaceId = (instanceId) => `${instanceId}${SURFACE_ID_SUFFIX}`

// CL-3 / T021a: count-up só nas primeiras ~2h de atraso. Acima disso (semanal/GLP-1, tolerância
// ~3,5 dias), cronômetro correndo dias é UX inaceitável → vira corpo estático via daysAgoLabel.
export const LATE_CHRONO_CAP_MINUTES = 120

// Estado `done` (spec.md:366 — matriz do designer): após o registro, a superfície vira um card de
// confirmação verde "Tomada às HH:mm ✓" que NÃO é ongoing e some sozinho. Spec pedia 3s (curto
// demais p/ ler — decisão PO 2026-06-28) → 3min via timeoutAfter, depois auto-dismiss.
export const DONE_CARD_TIMEOUT_MS = 3 * 60 * 1000

// Cor por estado via TOKENS (sem hex hardcoded — spec §9.6). A cor "liga" no upcoming (teal claro
// primary.200) e INTENSIFICA no now (teal forte primary.500) à medida que aproxima; later cinza
// neutro (presença distante); late âmbar (warning); done verde escuro; missed vermelho (error).
const STATE_ACCENT = Object.freeze({
  [DOSE_ACTIVITY_STATES.LATER]: colors.neutral[400],
  [DOSE_ACTIVITY_STATES.UPCOMING]: colors.primary[200],
  [DOSE_ACTIVITY_STATES.NOW]: colors.primary[500],
  [DOSE_ACTIVITY_STATES.LATE]: colors.status.warning,
  [DOSE_ACTIVITY_STATES.DONE]: colors.status.successDark,
  [DOSE_ACTIVITY_STATES.MISSED]: colors.status.error,
})

// Rótulo PT por estado (sincronizado com a cor). Título = nome+dose; corpo = estado · HH:mm.
const STATE_BODY = Object.freeze({
  [DOSE_ACTIVITY_STATES.LATER]: 'Próxima dose crítica',
  [DOSE_ACTIVITY_STATES.UPCOMING]: 'Dose crítica chegando',
  [DOSE_ACTIVITY_STATES.NOW]: 'Dose crítica agora',
  [DOSE_ACTIVITY_STATES.LATE]: 'Dose crítica pendente',
})

// Ações da superfície (IDs estáveis — R-222). Mapeiam p/ registro canônico (CON-026) / soneca.
export const SURFACE_ACTION = Object.freeze({
  REGISTER: 'surface-register',
  SNOOZE: 'surface-snooze',
})

let channelEnsured = false

/** Cria (idempotente) o canal DEFAULT silencioso da superfície. No-op se já criado. */
export async function ensureSurfaceChannel() {
  if (channelEnsured) return
  await notifee.createChannel({
    id: DOSE_ACTIVITY_CHANNEL_ID,
    name: 'Dose crítica – acompanhamento', // nome amigável p/ a paciente nas Configs do SO
    description: 'Aviso fixo que acompanha sua dose com contagem e botões de Registrar/Adiar.',
    importance: AndroidImportance.DEFAULT, // persistente, não intrusivo (não é alarme)
    sound: undefined,
    vibration: false,
  })
  channelEnsured = true
}

/**
 * Decide a config do cronômetro do estado `late` respeitando o cap (CL-3).
 * @returns {{ showChronometer: boolean, chronometerDirection?: 'up', timestamp?: number, bodySuffix: string }}
 */
function lateChronoConfig(activity, now) {
  const elapsedMin = activity.remainingSeconds == null ? 0 : Math.abs(activity.remainingSeconds) / 60
  if (elapsedMin <= LATE_CHRONO_CAP_MINUTES) {
    // count-up curto: timestamp no passado (scheduledFor) → cronômetro progressivo.
    return {
      showChronometer: true,
      chronometerDirection: 'up',
      timestamp: now.getTime() + (activity.remainingSeconds ?? 0) * 1000,
      bodySuffix: '',
    }
  }
  // Acima do cap: sem cronômetro, corpo estático com rótulo de dias (semanal/GLP-1).
  const label = daysAgoLabel(activity.scheduledFor, now) // 'ontem' / 'há N dias'
  return { showChronometer: false, bodySuffix: label ? ` · ${label}` : '' }
}

/**
 * Payload de registro embutido no `data` da notificação (tudo string — contrato Notifee).
 * Vem do DoseItem original (CON-024), pois o DoseActivityState (CON-029) não carrega
 * medicineId/protocolId/quantity. Reusado por Registrar/Adiar (CON-026 / soneca).
 */
/** null/undefined → ''; senão String(v). Mantém o payload (tudo string) sem ternários inline. @private */
function str(v) {
  return v != null ? String(v) : ''
}

function buildRegistrationData(activity, doseItem, discreet = false) {
  const di = doseItem || {}
  return {
    doseInstanceId: str(activity.instanceId),
    protocolId: str(di.protocolId),
    medicineId: str(di.medicineId),
    quantityTaken: String(di.dosagePerIntake ?? 1),
    medicineName: activity.medicineLabel || '',
    scheduledFor: activity.scheduledFor || '',
    scheduledTime: di.scheduledTime || '', // HH:mm — `at` do deeplink da modal bulk
    treatmentPlanName: di.treatmentPlanName || activity.medicineLabel || '',
    toleranceMinutes: str(di.toleranceMinutes),
    isCritical: activity.isCritical ? 'true' : 'false',
    treatmentId: str(activity.treatmentId),
    state: activity.state,
    __surface: 'true',
    // Campos p/ RECONSTRUIR o card no próximo boundary (advance headless, sem fetch) — F2
    // trigger-driven: o payload é self-contained. Inputs do formatDoseItem (título) + discreet.
    intakeUnit: str(di.intakeUnit),
    dosageUnit: str(di.dosageUnit),
    dosagePerPill: str(di.dosagePerPill),
    unitsPerMl: str(di.unitsPerMl),
    discreet: discreet ? 'true' : 'false',
  }
}

/**
 * Resolve corpo + config de cronômetro POR ESTADO (modelo PO 2026-06-28 — a state factory do
 * core já encoda as transições corretas, então a superfície segue o estado, não o sinal de tempo):
 *  - later: "Próxima dose", SEM cronômetro (distante).
 *  - upcoming: "Próxima dose", countdown regressivo (tá perto).
 *  - now: "Hora da dose", SEM cronômetro (é agora).
 *  - late: "Dose pendente", count-up (com cap CL-3 + rótulo de dias acima do cap).
 * @returns {{ body: string, chrono: object }}
 */
function resolveBodyAndChrono(activity, now, time) {
  const phrase = STATE_BODY[activity.state] ?? 'Acompanhe sua dose'
  let body = time ? `${phrase} · ${time}` : phrase

  // Countdown regressivo corre em upcoming E now enquanto FALTA tempo (>0) — não some nos 15min
  // finais (decisão PO 2026-06-28). Ao passar do horário (now, 0..+5min), cai no estático "agora".
  const wantsCountdown =
    (activity.state === DOSE_ACTIVITY_STATES.UPCOMING || activity.state === DOSE_ACTIVITY_STATES.NOW) &&
    activity.remainingSeconds != null &&
    activity.remainingSeconds > 0
  if (wantsCountdown) {
    return {
      body,
      chrono: { showChronometer: true, chronometerDirection: 'down', timestamp: now.getTime() + activity.remainingSeconds * 1000 },
    }
  }
  if (activity.state === DOSE_ACTIVITY_STATES.LATE) {
    const c = lateChronoConfig(activity, now)
    body = `${body}${c.bodySuffix}`
    return {
      body,
      chrono: c.showChronometer
        ? { showChronometer: true, chronometerDirection: c.chronometerDirection, timestamp: c.timestamp }
        : {},
    }
  }
  return { body, chrono: {} } // later, now → sem cronômetro
}

/**
 * Monta a ongoing notification a partir de um DoseActivityState (CON-029). Exportado p/ o
 * scheduler (F2 trigger-driven) montar o payload de cada boundary agendado.
 * @param {object} activity - DoseActivityState (& opts de exibição)
 * @param {{ now: Date, discreet: boolean, doseItem?: object }} ctx
 */
export function buildSurfaceNotification(activity, { now, discreet, doseItem }) {
  // Título = nome + dose (smoke #2: só o nome é referência fraca). Dose via formatter canônico do
  // core (R-272). Privacidade na lock (PO-SEC-1) = SO via `visibility: PRIVATE`, não apagando nome.
  const doseLabel = doseItem ? formatDoseItem(doseItem) : ''
  const title = doseLabel ? `${activity.medicineLabel || 'Dose'} · ${doseLabel}` : activity.medicineLabel || 'Dose'
  // Horário agendado (HH:mm local) — horário explícito evita o usuário "fazer contas" (smoke #2).
  const time = doseItem?.scheduledTime || ''
  const { body, chrono } = resolveBodyAndChrono(activity, now, time)

  // Ações só de `upcoming` em diante (decisão PO 2026-06-28): `later` é presença/lembrete distante
  // (60–240min), sem Registrar/Adiar — agir numa dose tão distante não faz sentido. upcoming/now/late
  // mostram os botões.
  const showActions = activity.state !== DOSE_ACTIVITY_STATES.LATER
  const actions = showActions
    ? [
        // Registrar ABRE o app na modal bulk (sítio de aplicação do injetável só é selecionável
        // lá — decisão PO 2026-06-28). launchActivity traz o app ao foreground; handleAlarmAction
        // navega via deeplink. Difere do press do CORPO (sem launch), que continua não navegando
        // (AP-207 — evita o listener do expo capturar e ir p/ 'Hoje').
        { title: 'Registrar', pressAction: { id: SURFACE_ACTION.REGISTER, launchActivity: 'default' } },
        { title: 'Adiar', pressAction: { id: SURFACE_ACTION.SNOOZE } },
      ]
    : undefined

  return {
    id: surfaceId(activity.instanceId), // id próprio — NÃO colidir com o trigger do alarme
    title,
    body,
    data: buildRegistrationData(activity, doseItem, discreet),
    android: {
      channelId: DOSE_ACTIVITY_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT,
      visibility: discreet ? AndroidVisibility.PRIVATE : AndroidVisibility.PUBLIC,
      color: STATE_ACCENT[activity.state] ?? colors.neutral[400],
      smallIcon: 'ic_dosiq_mark', // ícone dosiq (T026f — vector drawable mono)
      ongoing: true,
      autoCancel: false,
      onlyAlertOnce: true, // updates de estado não re-alertam
      ...(actions ? { actions } : {}),
      ...chrono,
    },
  }
}

/**
 * Exibe/atualiza a superfície p/ a dose ativa. `done`/`missed` são terminais: encerra (não
 * mantém ongoing). Estados actionáveis renderizam a ongoing notification.
 * @param {object|null} activity - DoseActivityState (saída de selectActiveDoseActivity) ou null
 * @param {{ now?: Date, discreet?: boolean, doseItem?: object }} [ctx]
 */
export async function showDoseActivity(activity, { now = getRawNow(), discreet = false, doseItem } = {}) {
  if (!activity || !activity.instanceId) return
  // Terminais não ocupam superfície persistente (cancel-on-resolve cuida do done real).
  if (activity.state === DOSE_ACTIVITY_STATES.DONE || activity.state === DOSE_ACTIVITY_STATES.MISSED) {
    await endDoseActivity(activity.instanceId)
    return
  }
  await ensureSurfaceChannel()
  await notifee.displayNotification(buildSurfaceNotification(activity, { now, discreet, doseItem }))
}

/** Formata um instante como HH:mm (fuso do device — "tomada agora"). Inválido → ''. @private */
function formatClock(takenAt) {
  const d = takenAt instanceof Date ? takenAt : takenAt ? parseISO(takenAt) : getRawNow()
  if (Number.isNaN(d.getTime())) return ''
  // Hermes tem suporte ICU limitado → Intl.DateTimeFormat com opções pode falhar/divergir
  // (.gemini/styleguide.md). HH:mm no fuso local: extrai direto do Date + zero-pad. (#898)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Exibe o card de confirmação `done` (spec.md:366) após o registro: verde, NÃO ongoing,
 * auto-dismiss em DONE_CARD_TIMEOUT_MS. Substitui (mesmo id) a ongoing já encerrada pelo
 * cancel-on-resolve. Sem ações/cronômetro — é só confirmação de leitura.
 * @param {{ instanceId: string, medicineLabel?: string, takenAt?: Date|string, doseItem?: object }} ctx
 */
export async function showDoseDone({ instanceId, medicineLabel, takenAt, doseItem } = {}) {
  if (!instanceId) return
  await ensureSurfaceChannel()
  const doseLabel = doseItem ? formatDoseItem(doseItem) : ''
  const title = doseLabel ? `${medicineLabel || 'Dose'} · ${doseLabel}` : medicineLabel || 'Dose'
  const time = formatClock(takenAt)
  await notifee.displayNotification({
    id: surfaceId(instanceId), // mesmo namespace da superfície — substitui a ongoing encerrada
    title,
    body: time ? `Tomada às ${time} ✓` : 'Dose tomada ✓',
    android: {
      channelId: DOSE_ACTIVITY_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT,
      color: STATE_ACCENT[DOSE_ACTIVITY_STATES.DONE],
      smallIcon: 'ic_dosiq_mark',
      ongoing: false, // terminal — paciente pode dispensar
      autoCancel: true,
      timeoutAfter: DONE_CARD_TIMEOUT_MS, // some sozinho (3min)
      onlyAlertOnce: true,
    },
  })
}

/**
 * Lê o rótulo (nome) da superfície 039 ATIVA de uma dose, se existir. Usado pelo choke point de
 * registro (doseService._cancelAlarmBestEffort) p/ decidir se mostra o card `done` — só doses que
 * TINHAM superfície ganham confirmação (auto-gate: não-críticas/sem superfície → null → sem card).
 * DEVE ser chamado ANTES do cancelAlarm (que cancela a notif pelo mesmo id). Best-effort → null.
 * @param {string} instanceId
 * @returns {Promise<string|null>} medicineLabel ou null se não houver superfície 039
 */
export async function readSurfaceLabel(instanceId) {
  if (!instanceId) return null
  const id = surfaceId(instanceId) // a superfície usa id próprio (sufixo)
  let displayed = []
  try {
    displayed = await notifee.getDisplayedNotifications()
  } catch {
    return null
  }
  const found = displayed.find((n) => (n?.id ?? n?.notification?.id) === id)
  const data = found?.notification?.data || {}
  if (data.__surface !== 'true') return null
  return data.medicineName || found?.notification?.title || 'Dose'
}

/**
 * Encerra a superfície de uma dose (cancel-on-resolve, AP-235 / PO-2.2). Best-effort.
 * @param {string} instanceId
 */
export async function endDoseActivity(instanceId) {
  if (!instanceId) return
  const id = surfaceId(instanceId) // id próprio da superfície (NÃO o do alarme)
  try {
    await notifee.cancelNotification(id)
  } catch {
    // best-effort — superfície sumindo não deve quebrar o registro
  }
  try {
    // F2 trigger-driven: cancelar também o boundary pendente da superfície p/ não re-exibir pós-resolve.
    await notifee.cancelTriggerNotification(id)
  } catch {
    // best-effort
  }
}

export const doseActivitySurfaceService = {
  ensureSurfaceChannel,
  showDoseActivity,
  showDoseDone,
  endDoseActivity,
  LATE_CHRONO_CAP_MINUTES,
  DONE_CARD_TIMEOUT_MS,
}
