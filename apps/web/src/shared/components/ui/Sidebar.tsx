import { Calendar, Pill, Package, User, Bell } from 'lucide-react'
import RegisterSpeedDial from './RegisterSpeedDial'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import { isConsentAllowedView } from '@shared/hooks/useConsentGate'
import './Sidebar.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Hoje', Icon: Calendar },
  { id: 'treatment', label: 'Tratamentos', Icon: Pill },
  { id: 'stock', label: 'Estoque', Icon: Package },
  { id: 'notifications', label: 'Avisos', Icon: Bell },
  { id: 'profile', label: 'Perfil', Icon: User },
]

export default function Sidebar({ currentView, setCurrentView, onRegisterDose, onRegisterMeasure, unreadCount = 0, consentLocked = false }) {
  // Spec 044 F3: item "Estoque" some da navegação quando o controle de estoque está
  // desligado (preferência global — fail-safe = ligado enquanto o provider não resolve).
  const { enabled: stockTrackingEnabled } = useStockTracking()
  // 046: com o consentimento revogado, a navegação some tudo que é PRODUTO — sobram só as rotas da
  // allowlist (perfil, onde vive o export). Clicar em produto cairia no guard de qualquer forma;
  // esconder aqui evita a UI que promete acesso que a trava vai negar.
  const navItems = NAV_ITEMS.filter((item) => {
    if (item.id === 'stock' && !stockTrackingEnabled) return false
    if (consentLocked && !isConsentAllowedView(item.id)) return false
    return true
  })

  return (
    <aside className="sidebar" aria-label="Menu lateral">
      <div className="sidebar-brand">
        <img src="/dosiq-logo-verde.svg" alt="" width="48" height="48" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          <span className="sidebar-brand-title">dosiq</span>
          <span className="sidebar-brand-subtitle">inteligência em doses</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sidebar-nav-item${currentView === id ? ' sidebar-nav-item--active' : ''}`}
            onClick={() => setCurrentView(id)}
            aria-current={currentView === id ? 'page' : undefined}
            aria-label={id === 'notifications' && unreadCount > 0 ? `${label} — ${unreadCount} não lidas` : label}
          >
            <span className="sidebar-icon-wrap">
              <Icon size={20} aria-hidden="true" />
              {id === 'notifications' && unreadCount > 0 && (
                <span className="sidebar-badge" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Registro de dose/medida é tratamento de dado de saúde — some com o consentimento revogado. */}
      {!consentLocked && (
        <div className="sidebar-footer">
          <RegisterSpeedDial
            variant="sidebar"
            onRegisterDose={onRegisterDose}
            onRegisterMeasure={onRegisterMeasure}
          />
        </div>
      )}
    </aside>
  )
}
