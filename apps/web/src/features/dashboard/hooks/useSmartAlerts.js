import { useMemo } from 'react'

/**
 * useSmartAlerts - Hook para computar alertas inteligentes
 * 
 * @param {object} stockSummary - Sumário de estoque
 * @param {object} zones - Zonas de doses (late, now, next)
 * @param {object} snoozedAlerts - Alertas silenciados
 * @returns {Array} Lista de alertas formatados
 */
export function useSmartAlerts(stockSummary, zones, snoozedAlerts) {
  return useMemo(() => {
    const alerts = []

    // 1. Stock alerts
    stockSummary?.items?.forEach((item) => {
      if (snoozedAlerts[`stock-${item.medicineId}`]) return
      if (item.stockStatus === 'critical' || item.stockStatus === 'low') {
        const severity = item.stockStatus === 'critical' ? 'critical' : 'warning'
        alerts.push({
          id: `stock-${item.medicineId}`,
          severity,
          title:
            severity === 'critical'
              ? `Estoque crítico — ${item.medicineName}`
              : `Estoque baixo — ${item.medicineName}`,
          message:
            severity === 'critical'
              ? `${item.quantity ?? 0} unidades restantes. Reposição urgente.`
              : `${item.daysRemaining} dias restantes. Programe a compra.`,
          actions: [{ label: 'Registrar Compra', type: 'primary' }],
        })
      }
    })

    // 2. Doses atrasadas (zones.late)
    const lateDoses = (zones.late || []).filter((d) => !d.isRegistered)
    if (lateDoses.length > 0 && !snoozedAlerts['late-doses']) {
      const names = lateDoses
        .slice(0, 2)
        .map((d) => d.medicineName)
        .join(', ')
      const extra = lateDoses.length > 2 ? ` +${lateDoses.length - 2}` : ''
      alerts.push({
        id: 'late-doses',
        severity: 'warning',
        title: `${lateDoses.length} dose${lateDoses.length > 1 ? 's' : ''} atrasada${lateDoses.length > 1 ? 's' : ''}`,
        message: `${names}${extra} — registre agora para manter sua adesão.`,
        actions: [{ label: 'Registrar Agora', type: 'primary' }],
      })
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 }
      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2)
    })
  }, [stockSummary, zones, snoozedAlerts])
}
