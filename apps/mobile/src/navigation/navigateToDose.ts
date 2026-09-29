// navigateToDose — levar a pessoa do lembrete até a dose (spec 090 D-2/D-3 · RC3 F2 · RC-SEC S3).
//
// ═══ O BUG QUE ESTE HELPER EXISTE PARA IMPEDIR ═══
// Três portas de entrada (Registrar do alarme Android, Registrar da Live Activity iOS, toque no push)
// faziam `navigationRef.navigate(ROUTES.TODAY, params)` a partir do ROOT. `Hoje` é Tab.Screen dentro de
// `RootTabs` (ROUTES.TABS); o RootStack não a conhece. Só funcionava quando o navegador de abas estava
// na cadeia focada. Com o alarme em tela cheia na frente (modal irmão de TABS) ou com as abas ainda não
// montadas no cold start: `NAVIGATE {"name":"Hoje"} was not handled` — e a pessoa não chegava à dose.
//
// Correção: UM tiro aninhado a partir do root, `navigate(TABS, { screen: TODAY, params })` — ou
// `popTo(TABS, …)` quando há tela por cima das abas (o alarme) —, e só quando
// a árvore do root TEM `TABS` (`isReady()` diz que o container montou, não que as abas existem — a
// árvore pode ser a de consentimento ou a do onboarding, `Navigation.tsx`).
//
// 🔴 Payload de notificação é entrada externa: vira `params` de navegação. Só passa o que está na
// allowlist, com a forma certa (UUID, HH:mm). Qualquer desvio ⇒ Hoje sem params (PO-SEC-3). As três
// portas herdam a mesma checagem por passarem todas por aqui.

import { StackActions } from '@react-navigation/native'
import { navigationRef } from '@navigation/navigationRef'
import { ROUTES } from '@navigation/routes'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_NAME_LENGTH = 120
const RETRY_INTERVAL_MS = 100
const RETRY_TIMEOUT_MS = 5000

export const DOSE_SCREENS = ['dose-individual', 'bulk-plan', 'bulk-misc'] as const
export type DoseScreen = (typeof DOSE_SCREENS)[number]

export type DoseParams =
  | { screen: 'dose-individual'; protocolId: string; at?: string }
  | { screen: 'bulk-plan'; planId: string; at?: string; treatmentPlanName?: string }
  | { screen: 'bulk-misc'; protocolIds: string[]; at?: string }

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

// `at` é opcional ('' = sem horário, formato dos produtores atuais); presente e malformado invalida tudo.
function readAt(raw: Record<string, unknown>): { ok: boolean; at?: string } {
  const at = raw.at
  if (at == null || at === '') return { ok: true }
  return typeof at === 'string' && HHMM_RE.test(at) ? { ok: true, at } : { ok: false }
}

/**
 * Params validados da modal de dose, ou `null` quando o payload não é um destino de dose bem formado.
 * Chamador trata `null` como "abre o Hoje sem modal".
 */
export function buildDoseParams(raw: unknown): DoseParams | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const { ok, at } = readAt(p)
  if (!ok) return null
  const withAt = at ? { at } : {}

  if (p.screen === 'dose-individual') {
    return isUuid(p.protocolId) ? { screen: 'dose-individual', protocolId: p.protocolId, ...withAt } : null
  }
  if (p.screen === 'bulk-plan') {
    if (!isUuid(p.planId)) return null
    const name = typeof p.treatmentPlanName === 'string' ? p.treatmentPlanName.slice(0, MAX_NAME_LENGTH) : undefined
    return { screen: 'bulk-plan', planId: p.planId, ...withAt, ...(name ? { treatmentPlanName: name } : {}) }
  }
  if (p.screen === 'bulk-misc') {
    const ids = p.protocolIds ?? []
    if (!Array.isArray(ids) || !ids.every(isUuid)) return null
    return { screen: 'bulk-misc', protocolIds: ids, ...withAt }
  }
  return null
}

/** `true` quando o root já montou E tem as abas (não é a árvore de consentimento/onboarding). */
function tabsMounted(): boolean {
  if (!navigationRef.isReady?.()) return false
  const routeNames = navigationRef.getRootState?.()?.routeNames
  return Array.isArray(routeNames) && routeNames.includes(ROUTES.TABS)
}

/**
 * Leva à aba `tab` (com params aninhados, se houver) assim que `TABS` existir; tenta a cada 100 ms e
 * desiste em silêncio após 5 s (conta travada no consentimento/onboarding: destino não existe).
 */
function navigateWhenTabsReady(tab: string, params?: object): void {
  const go = () => {
    const nested = { screen: tab, ...(params ? { params } : {}) }
    // 🔴 React Navigation 7: `navigate` NÃO volta para rota que já está no stack (isso virou
    // `popTo`). Com o alarme em tela cheia por cima (`[TABS, ALARM_FULLSCREEN]`), o `navigate`
    // atualizava as abas por baixo e a modal da dose abria POR CIMA do alarme (smoke 28/09).
    // Algo acima de TABS no root ⇒ `popTo(TABS)` tira o que está por cima.
    const root = navigationRef.getRootState?.()
    const top = root?.routes?.[root.index ?? 0]
    if (top?.name && top.name !== ROUTES.TABS) {
      navigationRef.dispatch(StackActions.popTo(ROUTES.TABS, nested))
      return
    }
    // Aba de destino já focada (ou abas recém-montadas, sem estado: a 1ª aba é o Hoje) e nada por
    // cima ⇒ NÃO navega. React Navigation 7 SUBSTITUI os params no `navigate`: navegar para o Hoje
    // já aberto apagava a dose que ele acabara de receber pelo canal (smoke 28/09, cold start).
    const tabsState = top?.state as { index?: number; routes?: { name: string }[] } | undefined
    const focusedTab = tabsState?.routes?.[tabsState.index ?? 0]?.name ?? ROUTES.TODAY
    if (!params && focusedTab === tab) return
    ;(navigationRef.navigate as any)(ROUTES.TABS, nested)
  }
  if (tabsMounted()) {
    go()
    return
  }
  let waited = 0
  const interval = setInterval(() => {
    waited += RETRY_INTERVAL_MS
    if (tabsMounted()) {
      clearInterval(interval)
      go()
    } else if (waited >= RETRY_TIMEOUT_MS) {
      clearInterval(interval)
    }
  }, RETRY_INTERVAL_MS)
}

// ═══ ENTREGA DA DOSE AO HOJE: canal próprio, não params aninhados ═══
// Smoke 28/09 (cold start real, processo morto): `navigate(TABS, {screen: TODAY, params})` chegava
// com o navegador de abas ainda inicializando e os params se perdiam (o Hoje renderizava sem eles),
// ou as abas montavam depois de o retry de 5 s desistir. Nos dois casos: app aberto, sem modal.
// Params aninhados são entrega "melhor esforço" no cold start — dependem do tempo de montagem.
// Aqui a dose vai para um canal: o Hoje ASSINA (`subscribePendingDose`) e a recebe na hora se já
// estiver montado, ou ao montar se vier depois; ele mesmo a põe nos próprios params (`setParams`,
// determinístico). A navegação só leva o Hoje ao foco e tira o alarme da frente.
const PENDING_TTL_MS = 60_000
type Delivered = DoseParams
let pendingDose: { params: Delivered; at: number } | null = null
let listener: ((p: Delivered) => void) | null = null

function takePending(): Delivered | null {
  const p = pendingDose
  pendingDose = null
  if (!p || Date.now() - p.at > PENDING_TTL_MS) return null
  return p.params
}

/**
 * O Hoje assina a entrega de doses. Recebe na hora a pendente (cold start: chegou antes de ele
 * montar; vence em 60 s) e as próximas enquanto estiver montado. Devolve o cancelamento.
 */
export function subscribePendingDose(fn: (p: Delivered) => void): () => void {
  listener = fn
  const p = takePending()
  if (p) fn(p)
  return () => {
    if (listener === fn) listener = null
  }
}

/** Abre o Hoje na modal da dose (params inválidos ⇒ Hoje sem modal). */
export function navigateToDose(raw: unknown): void {
  const params = buildDoseParams(raw)
  // ORDEM: navegar ANTES de entregar — o popTo/navigate pode reescrever os params do Hoje; a entrega
  // (setParams do próprio Hoje) vem depois e é a que vale.
  navigateWhenTabsReady(ROUTES.TODAY)
  if (!params) return
  pendingDose = { params, at: Date.now() }
  if (listener) {
    const p = takePending()
    if (p) listener(p)
  }
}

/**
 * Histórico de doses (push de relatório — C1.5 G-2). `DoseHistory` mora no stack da aba Perfil;
 * `initial: false` mantém a raiz do Perfil embaixo, para o voltar e o re-tap da aba funcionarem
 * (a classe de bug que o `navigateCrossTab` documenta).
 */
export function navigateToHistory(): void {
  navigateWhenTabsReady(ROUTES.PROFILE, { screen: ROUTES.DOSE_HISTORY, initial: false })
}

/**
 * Hub Privacidade e dados (push `consent_prune_notice`). Mora no ROOT só na árvore de consentimento
 * travado; com o app normal, no stack do Perfil — mesma classe do `history`.
 */
export function navigateToPrivacyData(): void {
  const rootNames = navigationRef.isReady?.() ? navigationRef.getRootState?.()?.routeNames : undefined
  if (Array.isArray(rootNames) && rootNames.includes(ROUTES.PRIVACY_DATA)) {
    ;(navigationRef.navigate as any)(ROUTES.PRIVACY_DATA)
    return
  }
  navigateWhenTabsReady(ROUTES.PROFILE, { screen: ROUTES.PRIVACY_DATA, initial: false })
}
