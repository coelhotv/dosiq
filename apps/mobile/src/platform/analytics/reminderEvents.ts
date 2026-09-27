// reminderEvents.ts — `reminder_opened` e origem do lembrete (spec 065 AD-8 / PR C2b).
//
// Gargalo ÚNICO da emissão de "o lembrete abriu o app": push do servidor (`navigateFromPush`),
// alarme/dose ativa no Android (`AlarmSchedulerBridge` + `handleAlarmAction`) e Live Activity do
// iOS (`DoseLiveActivityBridge`) chamam daqui — nenhum handler monta o payload à mão.

import { logEvent } from './productAnalytics'
import { EVENTS, SURFACES, REMINDER_SOURCES } from './analyticsEvents'

// Kinds do servidor que SÃO lembrete de dose (`server/notifications/payloads/_payloadSchemas.ts`).
// Estoque, relatório, titulação etc. abrem o app mas não são "o lembrete da dose".
export const DOSE_REMINDER_KINDS = ['dose_reminder', 'dose_reminder_by_plan', 'dose_reminder_misc']

// O mesmo toque pode chegar por 2 caminhos (ex.: "Registrar" com app morto → handler headless do
// Notifee E `getInitialNotification`). Janela curta por (source, dose): conta 1×. Em memória de
// propósito — o caso é o mesmo processo JS recebendo o mesmo toque duas vezes, não sessões distintas.
const DEDUPE_MS = 10_000
const recent = new Map()

/**
 * Origem de um aviso LOCAL do Notifee a partir do `data` da notificação. `null` quando não é
 * lembrete de dose (sem `doseInstanceId`) — o chamador não emite.
 */
export function localReminderSource(data) {
  if (!data?.doseInstanceId) return null
  return data.__surface === 'true' ? REMINDER_SOURCES.DOSE_ACTIVITY : REMINDER_SOURCES.ALARM
}

/**
 * Emite `reminder_opened`. `key` identifica o aviso (doseInstanceId, ou o kind do push) para o
 * dedupe. `surface` é sempre `push`: toda abertura parte de um toque na notificação (analysis-prC2
 * G-4); o canal do aviso vai em `source`.
 */
export function emitReminderOpened(source, key = null) {
  if (!source) return
  const dedupeKey = `${source}:${key ?? ''}`
  const now = Date.now()
  const last = recent.get(dedupeKey)
  if (last != null && now - last < DEDUPE_MS) return
  recent.set(dedupeKey, now)
  logEvent(EVENTS.REMINDER_OPENED, { source, surface: SURFACES.PUSH })
}

/**
 * Push do servidor: só os kinds de LEMBRETE de dose contam. Chave do dedupe = destino do toque
 * (o mesmo push entregue 2× não conta 2×).
 */
export function emitServerReminderOpened(data) {
  if (!DOSE_REMINDER_KINDS.includes(data?.kind)) return
  emitReminderOpened(REMINDER_SOURCES.SERVER_PUSH, JSON.stringify(data.navigation ?? data.kind))
}

/** @internal — só testes. */
export function __resetReminderDedupe() {
  recent.clear()
}
