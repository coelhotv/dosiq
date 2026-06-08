// apps/web/src/views/admin/nudgeFormUtils.js
// Utilitários para construção inteligente de payloads de nudge

// Mapeamento de rotas para suas abas e níveis
const TAB_ROUTES = {
  Hoje: ['Hoje'],
  Tratamentos: ['Tratamentos', 'TreatmentsList', 'ProtocolForm'],
  Estoque: ['Estoque', 'StockMain', 'PurchaseForm'],
  Perfil: [
    'Perfil',
    'ProfileMain',
    'ProfileEdit',
    'Settings',
    'ChangePassword',
    'TelegramLink',
    'NotificationPreferences',
    'NotificationInbox',
    'Feedback',
    'DoseHistory'
  ],
}

// Construir lista de rotas com metadata
export function getRoutesWithMetadata() {
  const routes = []

  Object.entries(TAB_ROUTES).forEach(([tab, screenList]) => {
    screenList.forEach((screen) => {
      routes.push({
        value: screen,
        label: screen === tab ? `${screen} (aba)` : screen,
        tab: tab === screen ? null : tab,
        isTabRoute: tab === screen,
      })
    })
  })

  return routes
}

// Obter aba para uma rota
export function getTabForRoute(routeName) {
  for (const [tab, routes] of Object.entries(TAB_ROUTES)) {
    if (routes.includes(routeName)) {
      return tab === routeName ? null : tab
    }
  }
  return null
}

// Montar payload navigate conforme tipo
export function buildNavigatePayload({ selectedRoute, label, emoji }) {
  if (!selectedRoute) return {}

  const tab = getTabForRoute(selectedRoute)

  const payload = {
    emoji: emoji || undefined,
    label: label || 'Ver mais',
  }

  // Remove campos vazios
  if (!payload.emoji) delete payload.emoji
  if (!payload.label) delete payload.label

  // Se rota requer cross-tab, usar tab+screen
  if (tab) {
    return {
      ...payload,
      tab,
      screen: selectedRoute,
    }
  }

  // Senão, usar route direto (1º nível = aba)
  return {
    ...payload,
    route: selectedRoute,
  }
}

// Exportar lista simples para dropdown
export function getRouteOptions() {
  return getRoutesWithMetadata()
}
