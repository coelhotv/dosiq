/**
 * Mapeia notification_type para configuração de ícone, cor e label legível.
 * Independente de plataforma — não importa lucide-react nem RN aqui.
 *
 * @param {string} type - Valor do campo notification_type no DB
 * @returns {{ iconName: string, color: string, bgColor: string, label: string, deepLinkAction: string|null }}
 */
export function getNotificationIcon(type) {
  const map = {
    dose_reminder: {
      iconName: 'Clock',
      color: '#006a5e',
      bgColor: 'rgba(0, 106, 94, 0.10)',
      label: 'Lembrete de dose',
      deepLinkAction: 'dashboard',
    },
    stock_alert: {
      iconName: 'Package',
      color: '#d97706',
      bgColor: 'rgba(217, 119, 6, 0.10)',
      label: 'Alerta de estoque',
      deepLinkAction: 'stock',
    },
    missed_dose: {
      iconName: 'AlertTriangle',
      color: '#dc2626',
      bgColor: 'rgba(220, 38, 38, 0.10)',
      label: 'Dose perdida',
      deepLinkAction: 'history',
    },
    daily_digest: {
      iconName: 'BarChart2',
      color: '#0284c7',
      bgColor: 'rgba(2, 132, 199, 0.10)',
      label: 'Resumo diário',
      deepLinkAction: null,
    },
    titration_update: {
      iconName: 'TrendingUp',
      color: '#16a34a',
      bgColor: 'rgba(22, 163, 74, 0.10)',
      label: 'Atualização de titulação',
      deepLinkAction: 'treatment',
    },
  }
  return map[type] ?? {
    iconName: 'Bell',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.10)',
    label: 'Notificação',
    deepLinkAction: null,
  }
}

/**
 * Formata uma data ISO em texto relativo legível (pt-BR).
 *
 * @param {string} isoString - Data ISO do campo sent_at
 * @returns {string}
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return ''
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diff = now - then

  const minute = 60 * 1000
  const hour   = 60 * minute
  const day    = 24 * hour
  const week   = 7 * day

  if (diff < minute)    return 'agora'
  if (diff < hour)      return `há ${Math.floor(diff / minute)}min`
  if (diff < 2 * hour)  return 'há 1h'
  if (diff < day)       return `há ${Math.floor(diff / hour)}h`
  if (diff < 2 * day)   return 'ontem'
  if (diff < week)      return `há ${Math.floor(diff / day)} dias`

  return new Date(isoString).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
  })
}
