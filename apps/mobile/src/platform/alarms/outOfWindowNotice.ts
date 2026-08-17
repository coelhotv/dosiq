// outOfWindowNotice.ts — o que acontece DEPOIS que a guarda bilateral barra um disparo (spec 067 A2)
//
// A guarda (doseWindow.evaluateDoseWindow) responde "esta notificação não é desta dose".
// Cancelar o alarme é a parte fácil e já acontece no call site. Este módulo cobre as duas coisas que
// não podem ficar de fora:
//
//   1. TRILHA (US2 / FR-007): sem evento, o defeito volta a ser invisível — foi exatamente por não
//      existir `alarm_fired` antes do `snoozed` que o incidente de 2026-08-14 precisou de
//      arqueologia. Grava delta em segundos, sentido e device.
//   2. AVISO À PACIENTE (FR-019 / Constituição §IX): silenciar um alarme e não dizer nada deixa
//      alguém que ouviu o alarme achando que registrou a dose. Omissão em contexto clínico é
//      defeito de segurança, não economia de UI.
//
// FAIL-OPEN TOTAL (FR-008): este módulo nunca lança e nunca é pré-requisito do cancelamento. Se a
// trilha e o aviso falharem juntos, o alarme errado ainda foi silenciado.
//
// CONSENTIMENTO (FR-035 / Decisão 8): o descarte por consentimento revogado acontece no FLUSH
// (`AlarmSchedulerBridge.flushCriticalAudit`), não aqui. Aqui o evento só entra na fila do
// AsyncStorage — o headless não tem como ler consentimento (leitura de rede, foreground only), e
// enfiar um mecanismo novo no caminho mais frágil do app é o que a 065/D5 já decidiu não fazer.

import { Platform } from 'react-native'
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native'
import * as Device from 'expo-device'
import { parseISO } from '@dosiq/core'
import { createCriticalAuditQueue } from '@platform/audit/criticalAuditQueue'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import {
  DOSE_ACTIVITY_CHANNEL_ID,
  ensureSurfaceChannel,
} from '@platform/doseActivity/doseActivitySurfaceService'
import { OUT_OF_WINDOW_NOTICE_FLAG } from './doseWindow'

/** Evento novo do trail — verbatim igual ao CHECK do banco e ao CRITICAL_AUDIT_EVENTS (R-271). */
export const ALARM_OUT_OF_WINDOW_EVENT = 'alarm_out_of_window'

/**
 * FR-035 / Decisão 8 — a anomalia é a ÚNICA classe de evento que o consentimento revogado descarta.
 *
 * Ela coleta fabricante/modelo numa trilha de saúde (R-293), e o fail-open da FR-008 vale para falha
 * de rede — nunca para ausência de base legal. Os demais eventos seguem drenando: já ocorreram (base
 * de segurança), e retenção é problema do prune 90d / exclusão de conta.
 *
 * Predicado exportado em vez de inline no `flushCriticalAudit` porque é a regra que a PO-SEC-4 tem de
 * demonstrar — decisão de privacidade enterrada dentro de um componente React não é testável sem
 * montar a árvore, e o que não se testa direto se afrouxa sem ninguém ver.
 */
export function shouldDropOnRevokedConsent(evt: any, consentSuppressed: boolean): boolean {
  return Boolean(consentSuppressed) && evt?.event === ALARM_OUT_OF_WINDOW_EVENT
}

/** Status em que a dose já foi decidida: aviso viraria ruído sobre algo resolvido (FR-039). */
const RESOLVED_STATUSES = new Set(['taken', 'missed'])

/** Namespace próprio de id — não colide com o alarme nem com a superfície 039. */
const noticeId = (instanceId: string) => `oow-${instanceId}`

/**
 * Coalescência por dose (FR-039 / PO-16): 3 disparos tortos na mesma dose = 1 aviso, não 3.
 *
 * Em memória de propósito: o escopo é "uma rajada de disparos do SO na mesma sessão", que é o
 * fenômeno observado. Persistir em AsyncStorage traria escrita no caminho headless (AP-205) para
 * ganhar de-dupe entre reinícios de processo — troca ruim: se o app morreu e voltou, um segundo
 * aviso é informação legítima, não spam.
 *
 * A coalescência é por `dose_instance_id`, nunca global: duas doses distintas fora da janela são
 * dois fatos distintos e a paciente precisa saber dos dois.
 */
const noticedInstances = new Set<string>()

/** Reset entre testes / no logout. */
export function resetOutOfWindowNotices() {
  noticedInstances.clear()
}

/** HH:mm local do instante agendado. Hermes tem ICU limitado → sem Intl (#898). */
function formatClock(iso: string): string {
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * `detail` do evento — ALLOWLIST FECHADA (FR-036 / Decisão 8).
 *
 * 🔴 Proibido despejar o `data` da notificação aqui: ele carrega nome do medicamento, dosagem e
 * plano de tratamento, e isto é uma trilha de saúde. Cinco campos, nomeados um a um; qualquer campo
 * novo é decisão consciente, não efeito colateral de um spread.
 */
function buildDetail({ deltaSeconds, direction }: { deltaSeconds: number | null; direction: string | null }) {
  return {
    delta_seconds: deltaSeconds,
    direction,
    manufacturer: Device.manufacturer ?? null,
    model: Device.modelName ?? null,
    os_version: String(Platform.Version ?? ''),
  }
}

/** Dono da dose pela sessão persistida (funciona no headless). @private */
async function resolveUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Enfileira a anomalia na trilha. Espelha `beaconAlarmDelivered`: camelCase (shape de entrada do
 * `criticalAuditService.emit`, usado no flush — DRY CON-031) e sem dono ⇒ não enfileira (evento
 * órfão é proibido). @private
 */
async function enqueueAnomaly({
  doseInstanceId,
  deltaSeconds,
  direction,
}: {
  doseInstanceId: string
  deltaSeconds: number | null
  direction: string | null
}) {
  const userId = await resolveUserId()
  if (!userId) return
  const queue = createCriticalAuditQueue()
  await queue.enqueue({
    userId,
    doseInstanceId,
    event: ALARM_OUT_OF_WINDOW_EVENT,
    platform: Platform.OS,
    actor: 'system',
    detail: buildDetail({ deltaSeconds, direction }),
  })
}

/**
 * Aviso informativo (FR-019/FR-026 · copy da Decisão 9, verbatim).
 *
 * Canal: `DOSE_ACTIVITY_CHANNEL_ID` (hoje `dose-activity-v2`) — o ÚNICO canal existente sem som
 * (Decisão 10). Importado como CONSTANTE, nunca escrito como literal: canal é imutável e o id é
 * versionado (R-261), então um literal aqui envelheceria no próximo bump e a notificação iria pra um
 * canal inexistente. Criar canal novo é
 * proibido: canal Android é imutável após criado (R-261) e um canal novo importaria a dívida de
 * ícone/marca do AP-251. O `dosiq-default-v1` ("Lembretes e avisos") seria o nome mais natural, mas
 * tem `push_chime.wav` — e um som novo no meio da noite por causa de um alarme que JÁ tocou errado
 * seria castigo, não informação.
 *
 * O marcador `__outOfWindowNotice` é o que impede o aviso de ser confundido com dose por
 * `reconcileStaleDoseNotifications`/`pickPromotableAlarm` — ele vive no canal da superfície e carrega
 * `doseInstanceId`, então passaria nos predicados e cancelaria a si mesmo (AP-327: selecionar por
 * conteúdo, nunca por canal herdável).
 *
 * Sem ações: qualquer CTA aqui reabriria o caminho de registro que a guarda acabou de fechar.
 * @private
 */
async function showNotice({
  doseInstanceId,
  medicineName,
  scheduledFor,
}: {
  doseInstanceId: string
  medicineName: string
  scheduledFor: string
}) {
  const clock = formatClock(scheduledFor)
  const med = medicineName || 'sua dose'
  await ensureSurfaceChannel()
  await notifee.displayNotification({
    id: noticeId(doseInstanceId),
    title: 'Alarme fora de hora',
    body: clock
      ? `O alarme de ${med} tocou fora do horário e nada foi registrado. Sua dose é às ${clock} — vamos avisar de novo no horário certo.`
      : `O alarme de ${med} tocou fora do horário e nada foi registrado. Vamos avisar de novo no horário certo.`,
    data: { doseInstanceId, [OUT_OF_WINDOW_NOTICE_FLAG]: 'true' },
    android: {
      channelId: DOSE_ACTIVITY_CHANNEL_ID,
      importance: AndroidImportance.DEFAULT, // sem takeover: o evento não é a dose (RC2/D-3)
      visibility: AndroidVisibility.PRIVATE, // herda a política de lockscreen da dose, não inventa
      smallIcon: 'ic_dosiq_mark',
      ongoing: false,
      autoCancel: true,
      onlyAlertOnce: true,
    },
  })
}

/**
 * Dose já resolvida não recebe aviso (FR-039): se a paciente registrou por outro caminho, o alarme
 * torto deixou de ser notícia. Best-effort — falha de rede NÃO suprime o aviso (o silêncio é o
 * defeito que estamos corrigindo), então o default é AVISAR. @private
 */
async function isDoseResolved(doseInstanceId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('dose_instances')
      .select('status')
      .eq('id', doseInstanceId)
      .maybeSingle()
    if (error || !data) return false
    return RESOLVED_STATUSES.has(String(data.status))
  } catch {
    return false
  }
}

/**
 * Ponto único chamado quando a guarda barra um disparo: trilha + aviso, ambos best-effort.
 *
 * @param {object} params
 * @param {object} params.data - `notification.data` do disparo barrado
 * @param {string|null} params.direction - 'early' | 'late'
 * @param {number|null} params.deltaSeconds - now − scheduled (negativo = adiantado)
 * @returns {Promise<{ tracked: boolean, notified: boolean }>} para teste/observabilidade
 */
export async function reportOutOfWindowAlarm({
  data,
  direction = null,
  deltaSeconds = null,
}: {
  data?: any
  direction?: string | null
  deltaSeconds?: number | null
}): Promise<{ tracked: boolean; notified: boolean }> {
  const result = { tracked: false, notified: false }
  try {
    const doseInstanceId = data?.doseInstanceId
    if (!doseInstanceId) return result

    // A trilha vem primeiro: é o dado que permite descobrir que o problema recorre mesmo quando
    // ninguém olha a gaveta de notificações.
    try {
      await enqueueAnomaly({ doseInstanceId, deltaSeconds, direction })
      result.tracked = true
    } catch {
      // fail-open
    }

    if (noticedInstances.has(doseInstanceId)) return result
    if (await isDoseResolved(doseInstanceId)) return result

    try {
      await showNotice({
        doseInstanceId,
        medicineName: data?.medicineName ?? '',
        scheduledFor: data?.scheduledFor ?? '',
      })
      noticedInstances.add(doseInstanceId)
      result.notified = true
    } catch {
      // fail-open
    }
    return result
  } catch {
    return result
  }
}

export default reportOutOfWindowAlarm
