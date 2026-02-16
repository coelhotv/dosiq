import './QuickActionsWidget.css'

/**
 * QuickActionsWidget - Widget de Ações Rápidas
 *
 * Exibe botões grandes para ações frequentes no dashboard,
 * permitindo navegação rápida para as principais funcionalidades.
 *
 * Props:
 * - onRegisterDose: () => void - Abre formulário de registro de dose
 * - onAddStock: () => void - Navega para tela de adicionar estoque
 * - onViewHistory: () => void - Navega para histórico completo
 * - onViewProtocols: () => void - Navega para lista de protocolos
 */
export default function QuickActionsWidget({
  onRegisterDose,
  onAddStock,
  onViewHistory,
  onViewProtocols,
}) {
  const actions = [
    {
      id: 'register-dose',
      icon: '💊',
      title: 'Registrar Dose',
      description: 'Registrar que tomou remédio',
      variant: 'primary',
      onClick: onRegisterDose,
    },
    {
      id: 'add-stock',
      icon: '📦',
      title: 'Adicionar Estoque',
      description: 'Registrar nova compra',
      variant: 'secondary',
      onClick: onAddStock,
    },
    {
      id: 'view-history',
      icon: '📊',
      title: 'Ver Histórico',
      description: 'Ver registros passados',
      variant: 'tertiary',
      onClick: onViewHistory,
    },
  ]

  return (
    <div className="quick-actions-widget">
      <div className="quick-actions__header">
        <h3 className="quick-actions__title">Ações Rápidas</h3>
      </div>

      <div className="quick-actions__grid">
        {actions.map((action) => (
          <button
            key={action.id}
            className={`quick-action-btn quick-action-btn--${action.variant}`}
            onClick={action.onClick}
            disabled={!action.onClick}
          >
            <span className="quick-action-btn__icon">{action.icon}</span>
            <span className="quick-action-btn__title">{action.title}</span>
            <span className="quick-action-btn__description">{action.description}</span>
          </button>
        ))}
      </div>

      <div className="quick-actions__footer">
        <button className="quick-actions__link" onClick={onViewProtocols}>
          Ver todos os protocolos →
        </button>
      </div>
    </div>
  )
}
