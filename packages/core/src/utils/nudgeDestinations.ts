/**
 * nudgeDestinations — destinos canônicos da ação `navigate` dos nudges (028 emenda 2026-10).
 *
 * Fonte ÚNICA: o admin web monta o dropdown e o payload a partir daqui, e o app mobile só segue
 * payloads que batem com esta lista (`resolveNudgeDestination`). Antes cada lado tinha a sua versão
 * e a do admin oferecia tela que exige params (`PurchaseForm` sem `medicineId`).
 *
 * Regras de entrada na lista:
 * - a tela abre SEM params (detalhe de tratamento/estoque/medicamento depende de dado clínico de
 *   cada usuário — não há como um nudge global apontar para ele);
 * - não é fluxo de estado (consentimento, ativação de estoque, leitor de código) nem destrutiva.
 *
 * Nomes de rota espelham `apps/mobile/src/navigation/routes.ts` (o core não importa do app); o
 * teste `nudgeDestinations.routes.test.ts` do mobile garante que cada destino existe e está
 * registrado na pilha da aba declarada.
 */

export const NUDGE_TABS = ['Hoje', 'Tratamentos', 'Estoque', 'Perfil'] as const
export type NudgeTab = (typeof NUDGE_TABS)[number]

export interface NudgeDestination {
  /** Nome da rota no app (ROUTES). */
  screen: string
  /** Aba que hospeda a tela; `null` = a própria aba ou tela do stack raiz (navega por `route`). */
  tab: NudgeTab | null
  /** Rótulo PT-BR exibido no admin. */
  label: string
  /** Só faz sentido para quem tem controle de estoque ligado — o app esconde o nudge dos demais. */
  requiresStock?: boolean
}

export const NUDGE_DESTINATIONS: readonly NudgeDestination[] = [
  { screen: 'Hoje', tab: null, label: 'Hoje (aba)' },

  { screen: 'Tratamentos', tab: null, label: 'Tratamentos (aba)' },
  { screen: 'TreatmentsList', tab: 'Tratamentos', label: 'Tratamentos › Lista de tratamentos' },
  { screen: 'ProtocolForm', tab: 'Tratamentos', label: 'Tratamentos › Novo tratamento' },
  { screen: 'MedicinesList', tab: 'Tratamentos', label: 'Tratamentos › Lista de medicamentos' },
  { screen: 'MedicineCreate', tab: 'Tratamentos', label: 'Tratamentos › Novo medicamento' },

  { screen: 'Estoque', tab: null, label: 'Estoque (aba)', requiresStock: true },
  { screen: 'StockMain', tab: 'Estoque', label: 'Estoque › Visão geral', requiresStock: true },

  { screen: 'Perfil', tab: null, label: 'Perfil (aba)' },
  { screen: 'ProfileMain', tab: 'Perfil', label: 'Perfil › Início' },
  { screen: 'ProfileEdit', tab: 'Perfil', label: 'Perfil › Editar perfil' },
  { screen: 'Settings', tab: 'Perfil', label: 'Perfil › Configurações' },
  { screen: 'ChangePassword', tab: 'Perfil', label: 'Perfil › Alterar senha' },
  { screen: 'NotificationPreferences', tab: 'Perfil', label: 'Perfil › Preferências de notificação' },
  { screen: 'NotificationInbox', tab: 'Perfil', label: 'Perfil › Caixa de notificações' },
  { screen: 'Feedback', tab: 'Perfil', label: 'Perfil › Enviar feedback' },
  { screen: 'DoseHistory', tab: 'Perfil', label: 'Perfil › Histórico de doses' },
  { screen: 'Measures', tab: 'Perfil', label: 'Perfil › Medidas' },
  { screen: 'ClinicalReport', tab: 'Perfil', label: 'Perfil › Relatório clínico (PDF)' },
  { screen: 'PrivacyData', tab: 'Perfil', label: 'Perfil › Privacidade e dados' },

  { screen: 'Chat', tab: null, label: 'Chat IA' },
]

export interface NudgeNavigatePayload {
  tab?: string
  screen?: string
  route?: string
  label?: string
  emoji?: string
  [key: string]: unknown
}

/**
 * Destino canônico correspondente a um payload `navigate`, ou `null` se o payload não bate com
 * nenhum (forma `{ route }` para destinos sem aba; `{ tab, screen }` para sub-telas).
 */
export function resolveNudgeDestination(payload: NudgeNavigatePayload | null | undefined): NudgeDestination | null {
  if (!payload) return null
  const match = NUDGE_DESTINATIONS.find((d) =>
    d.tab === null
      ? payload.route === d.screen && !payload.tab
      : payload.tab === d.tab && payload.screen === d.screen
  )
  return match ?? null
}

/** Payload `navigate` canônico para um destino (vazio se a tela não está na lista). */
export function buildNudgeNavigatePayload(
  screen: string,
  extras: { label?: string; emoji?: string } = {},
): NudgeNavigatePayload {
  const dest = NUDGE_DESTINATIONS.find((d) => d.screen === screen)
  if (!dest) return {}
  const payload: NudgeNavigatePayload = {}
  if (extras.emoji) payload.emoji = extras.emoji
  payload.label = extras.label || 'Ver mais'
  if (dest.tab) {
    payload.tab = dest.tab
    payload.screen = dest.screen
  } else {
    payload.route = dest.screen
  }
  return payload
}
