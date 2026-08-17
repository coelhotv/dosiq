// doseWindow.ts — a janela de uma dose, avaliada num lugar só (spec 067 A2 / FR-001/FR-002)
//
// POR QUE ESTE ARQUIVO EXISTE SEPARADO
//   A avaliação nasceu dentro de `staleDoseNotifications` (que importa `alarmService` para cancelar).
//   Quando o `alarmService.scheduleSnooze` também passou a precisar da guarda (FR-006), surgiria um
//   ciclo `alarmService → staleDoseNotifications → alarmService`, que em ESM resolve para `undefined`
//   na primeira função avaliada e quebraria em runtime — no caminho do alarme, silenciosamente.
//   Regra pura, zero dependências de módulo do app: todo mundo importa daqui.
//
// A REGRA
//   fora da janela  ⇔  now > scheduled + tolerance   (atrasado — a dose virou missed)
//                   ∨  now < scheduled − earlyWindow (adiantado — disparo torto do SO)
//
//   Antes desta spec só existia o teto. O incidente de 2026-08-14 entrou pelo lado que não existia:
//   o SO disparou o alarme de uma dose de 13:30 às 09:47 (3h37 ADIANTADO), o takeover abriu normal e
//   o "Pular" destruiu a dose real. Janela com um lado só não é janela — é um limite.
//
// O PISO NÃO É CALCULADO AQUI (Decisão 6 / RC3-F1 / FR-024)
//   Vem de `dose_instances.early_window_minutes`, derivado na materialização pelo MESMO
//   `computeTolerances` que já produz `tolerance_minutes`. No disparo o device não tem o
//   `time_schedule` para re-derivar o intervalo, e uma segunda cópia da matemática no caminho
//   headless é exatamente o que a FR-024 proíbe. Aqui o client só LÊ.

import { parseISO, getRawNow } from '@dosiq/core'

/** Teto default da tomada (CON-026 — DEFAULT_TOLERANCE_MINUTES). */
export const DEFAULT_TOLERANCE_MINUTES = 120

/**
 * 067 A2 (FR-032): piso default quando o payload não traz `earlyWindowMinutes` — notificação já
 * agendada por uma versão anterior do app. FAIL-CLOSED em 120 (o mais largo do range), nunca 0, que
 * desligaria o lado adiantado da guarda justamente no caso que não podemos inspecionar.
 */
export const DEFAULT_EARLY_WINDOW_MINUTES = 120

/**
 * 067 A2 (Decisão 10): marcador do aviso informativo emitido quando a guarda barra um disparo.
 *
 * O aviso mora no canal da superfície de dose (o único silencioso — R-261 proíbe canal novo) e
 * carrega `doseInstanceId`, então PASSARIA nos predicados de dose e seria cancelado pela própria
 * reconciliação — é fora da janela por definição. Selecionar por CONTEÚDO (campo que só o nosso
 * aviso tem) em vez de por canal (metadado herdável) é a lição do AP-327/R-309 §2.
 */
export const OUT_OF_WINDOW_NOTICE_FLAG = '__outOfWindowNotice'

/** O aviso informativo da guarda — não é dose, não é superfície: não se cancela nem se promove. */
export function isOutOfWindowNotice(notification: any): boolean {
  const data = notification?.data || notification || {}
  return data[OUT_OF_WINDOW_NOTICE_FLAG] === 'true' || data[OUT_OF_WINDOW_NOTICE_FLAG] === true
}

/** Normaliza minuto vindo do `data` do Notifee (que serializa tudo como string). */
function minutesOrDefault(raw: unknown, fallback: number): number {
  if (raw == null || raw === '' || Number.isNaN(Number(raw))) return fallback
  return Number(raw)
}

export interface DoseWindowVerdict {
  outOfWindow: boolean
  direction: 'early' | 'late' | null
  /** now − scheduled, em segundos (NEGATIVO = adiantado). É o número que a telemetria grava. */
  deltaSeconds: number | null
}

/**
 * PONTO CANÔNICO ÚNICO da janela de dose (FR-002) — bilateral.
 *
 * Soneca legítima nunca cai no piso: `snoozeAttempt > 0` dispara DEPOIS de `scheduled_for` por
 * construção, e o piso só olha o lado adiantado.
 *
 * Sem `scheduledFor` → não afirma nada (não mexe), comportamento preservado do regime anterior:
 * uma notificação sem horário não é evidência de nada.
 *
 * @param data - `notification.data` (Notifee serializa tudo como string)
 */
export function evaluateDoseWindow(data: any, now: Date = getRawNow()): DoseWindowVerdict {
  const miss: DoseWindowVerdict = { outOfWindow: false, direction: null, deltaSeconds: null }
  if (!data?.scheduledFor) return miss
  const scheduledMs = parseISO(data.scheduledFor).getTime()
  if (Number.isNaN(scheduledMs)) return miss

  const tol = minutesOrDefault(data.toleranceMinutes, DEFAULT_TOLERANCE_MINUTES)
  const early = minutesOrDefault(data.earlyWindowMinutes, DEFAULT_EARLY_WINDOW_MINUTES)

  const deltaMs = now.getTime() - scheduledMs
  const deltaSeconds = Math.round(deltaMs / 1000)

  if (deltaMs > tol * 60000) return { outOfWindow: true, direction: 'late', deltaSeconds }
  if (deltaMs < -early * 60000) return { outOfWindow: true, direction: 'early', deltaSeconds }
  return { outOfWindow: false, direction: null, deltaSeconds }
}

/**
 * Predicado booleano — para consumidores que só decidem "cancela ou não". Quem precisa do
 * delta/sentido (telemetria, aviso informativo) chama `evaluateDoseWindow`.
 *
 * ⚠️ Nome antigo era `isDoseNotificationStale`. Renomear era o ponto da FR-002: `stale` significa
 * "vencida", e manter esse nome com semântica bilateral convida o próximo leitor a reintroduzir a
 * assimetria "corrigindo" o que pareceria um bug.
 */
export function isDoseNotificationOutOfWindow(data: any, now: Date = getRawNow()): boolean {
  return evaluateDoseWindow(data, now).outOfWindow
}
