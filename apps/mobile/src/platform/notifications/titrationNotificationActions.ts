// Ações interativas do push da Evolução do tratamento (029 F5 / T025 / FR-004).
//
// POR QUE ESTE ARQUIVO EXISTE: o `actionSchema` do servidor e a copy §8 sozinhos NÃO desenham
// botão nenhum no device. `categoryId` no payload apenas REFERENCIA uma categoria que precisa
// existir no app; sem o registro abaixo, o iOS entrega a notificação sem botões, em silêncio —
// exatamente o mesmo furo que o T015 fechou para o alarme de dose (`ensureAlarmCategories`).
//
// Modelo: `foreground:false` → a ação é resolvida em background, sem abrir o app. Só o toque no
// CORPO da notificação navega (usePushNotifications).
//
// 🔴 SEM LOCK NO CLIENTE (AP-221 / R-288): a exclusão mútua é o claim
// `WHERE status='pending_confirmation'` DENTRO da RPC. Double-tap no botão cai em
// `already_confirmed:true`, que é sucesso — não erro. Adicionar aqui um "já estou confirmando"
// seria um segundo primitivo de concorrência competindo com o do banco.

import * as Notifications from 'expo-notifications'
import { confirmTitrationSwitch } from '@features/treatments/services/titrationService'
import { triggerTitrationRefresh } from '@features/treatments/services/titrationRefreshBus'
import { logEvent } from '@platform/analytics/productAnalytics'
import { debugLog } from '@shared/utils/debugLog'

/** DEVE casar com `TITRATION_CATEGORY_ID` do expoPushChannel — o payload referencia este id. */
export const TITRATION_CATEGORY_ID = 'dosiq-titration-v1'

export const TITRATION_ACTION = {
  START_STEP: 'start_step',
  NOT_YET: 'not_yet',
} as const

let categoriesEnsured = false

/**
 * Registra a categoria com `[Iniciar etapa]` / `[Ainda não]` (Decisões §3.1 — as MESMAS 2 ações
 * do card do Hoje). Idempotente.
 *
 * ⚠️ Roda nas DUAS plataformas. `expo-notifications` implementa categorias também no Android
 * (`ExpoNotificationCategoriesModule.kt`) — é de lá que saem os botões da notificação. Gatear
 * isto em `Platform.OS === 'ios'` (o reflexo vindo do alarme, que usa **notifee**, onde as ações
 * de fato viajam no payload) entregaria push SEM botão no Android, em silêncio. As duas libs
 * coexistem no app e não seguem a mesma regra.
 */
export async function ensureTitrationCategories(): Promise<void> {
  if (categoriesEnsured) return
  await Notifications.setNotificationCategoryAsync(TITRATION_CATEGORY_ID, [
    {
      identifier: TITRATION_ACTION.START_STEP,
      buttonTitle: 'Iniciar etapa',
      options: { opensAppToForeground: false },
    },
    {
      identifier: TITRATION_ACTION.NOT_YET,
      buttonTitle: 'Ainda não',
      options: { opensAppToForeground: false },
    },
  ])
  categoriesEnsured = true
}

/**
 * Extrai o `stepId` que a RPC consome. O servidor o coloca em `data.actions[].params`.
 *
 * Aceita `actions` como array OU como string JSON: o transporte de push serializa `data` e nem
 * todo caminho devolve o objeto já parseado. Sem esta tolerância, o botão existiria, o handler
 * dispararia e o `stepId` viria `null` — a ação viraria no-op silencioso, que é pior que erro.
 * @private
 */
function _extractStepId(data: Record<string, unknown> | undefined, actionId: string): string | null {
  const raw = data?.actions
  let actions: Array<Record<string, any>> = []
  if (Array.isArray(raw)) {
    actions = raw as Array<Record<string, any>>
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) actions = parsed
    } catch {
      return null
    }
  }
  const match = actions.find((a) => a?.id === actionId)
  const stepId = match?.params?.stepId
  return typeof stepId === 'string' && stepId.length > 0 ? stepId : null
}

interface NotificationResponseLike {
  actionIdentifier?: string
  notification?: { request?: { content?: { data?: Record<string, unknown> } } }
}

/**
 * A resposta é uma ação DESTA feature? SÍNCRONO de propósito: o chamador decide na hora se
 * navega, sem esperar promise. Fazer essa decisão dentro de um `.then()` atrasaria a navegação
 * de TODA notificação por um microtask — regressão gratuita no deeplink que já funcionava.
 */
export function isTitrationAction(response: NotificationResponseLike): boolean {
  const actionId = response?.actionIdentifier
  return actionId === TITRATION_ACTION.START_STEP || actionId === TITRATION_ACTION.NOT_YET
}

/**
 * Executa a ação da evolução. Só chamar quando `isTitrationAction(response)` for true.
 */
export async function handleTitrationNotificationAction(
  response: NotificationResponseLike,
): Promise<boolean> {
  const actionId = response?.actionIdentifier
  if (!isTitrationAction(response)) return false

  const data = response?.notification?.request?.content?.data
  const stepId = _extractStepId(data, actionId)

  // "Ainda não" é um NO-OP deliberado (Decisões §3.2 — R-239: nudge, não nag): nada muda no
  // servidor, a etapa segue pendente e o card do Hoje vira a linha neutra sozinho. Não repetir
  // push é responsabilidade do motor (que só notifica quando o claim pega), não daqui.
  if (actionId === TITRATION_ACTION.NOT_YET) {
    // SEC-6: só IDs e tipos — nunca nome de medicamento ou dose.
    logEvent('titration_transition_postponed', { step_id: stepId ?? '', surface: 'push' })
    return true
  }

  if (!stepId) {
    debugLog('[titrationActions] start_step sem stepId no payload — ignorando')
    return true
  }

  const result = await confirmTitrationSwitch(stepId)
  // A ação não abre o app (`opensAppToForeground:false`): nenhuma tela perde/ganha foco e não há
  // transição de AppState. Sem este sinal o card do Hoje continuaria anunciando uma pendência já
  // resolvida. Emitir também no `already_confirmed` — nesse caso a escada TAMBÉM já mudou.
  if (result.ok !== false) triggerTitrationRefresh()
  // R-286: `=== false` estreita a união; `!result.ok` não discrimina sob `strict:false`.
  // `already_confirmed` é sucesso (double-tap/retry), não falha — medir separado evita ler
  // convergência como erro no funil.
  const outcome =
    result.ok === false ? result.reason : result.alreadyConfirmed ? 'already_confirmed' : 'confirmed'
  logEvent('titration_transition_confirmed', { step_id: stepId, surface: 'push', outcome })
  debugLog('[titrationActions] start_step →', outcome)
  return true
}
