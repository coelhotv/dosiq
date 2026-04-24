import { Calendar, Pill, Package, User, Bell } from 'lucide-react'
import './BottomNavRedesign.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Hoje', Icon: Calendar },
  { id: 'treatment', label: 'Tratamento', Icon: Pill },
  { id: 'stock', label: 'Estoque', Icon: Package },
  { id: 'notifications', label: 'Avisos', Icon: Bell },
  { id: 'profile', label: 'Perfil', Icon: User },
]

export default function BottomNavRedesign({ currentView, setCurrentView, unreadCount = 0 }) {
  return (
    <div
      className="bottom-nav-redesign-container"
      role="navigation"
      aria-label="Navegação principal"
    >
      <nav className="bottom-nav-redesign">
        {/* eslint-disable-next-line no-unused-vars */}
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`bnr-item${currentView === id ? ' bnr-item--active' : ''}`}
            onClick={() => setCurrentView(id)}
            aria-current={currentView === id ? 'page' : undefined}
            aria-label={id === 'notifications' && unreadCount > 0 ? `${label} — ${unreadCount} não lidas` : label}
          >
            <span className="bnr-icon-wrap">
              <Icon size={28} aria-hidden="true" />
              {id === 'notifications' && unreadCount > 0 && (
                <span className="bnr-badge" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span className="bnr-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
