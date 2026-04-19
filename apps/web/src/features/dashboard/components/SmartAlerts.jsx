import AlertList from '@shared/components/ui/AlertList'
import './SmartAlerts.css'

/**
 * SmartAlerts - Lista de alertas inteligentes com CTAs contextuais.
 *
 * Componente wrapper que usa AlertList base com variantes específicas.
 *
 * @param {Object} props
 * @param {Array} props.alerts - Lista de alertas
 * @param {Function} props.onAction - Callback para ações (TOMAR, ADIAR, COMPRAR)
 */
export default function SmartAlerts({ alerts = [], onAction }) {
  if (!alerts || alerts.length === 0) return null

  // Mapear alerts para formato padrao do AlertList
  const normalizedAlerts = alerts.map((alert) => ({
    id: alert.id,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    actions: alert.actions?.map((a) => ({
      label: a.label,
      type: a.type,
      title: a.title,
      actionId: a.label,
    })),
  }))

  return (
    <AlertList
      alerts={normalizedAlerts}
      onAction={onAction}
      variant="smart"
      showExpandButton={false}
      maxVisible={alerts.length}
    />
  )
}
