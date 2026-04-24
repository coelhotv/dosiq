import { Calendar, Pill, Package, User, Bell, Plus } from 'lucide-react'
import './Sidebar.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Hoje', Icon: Calendar },
  { id: 'treatment', label: 'Tratamento', Icon: Pill },
  { id: 'stock', label: 'Estoque', Icon: Package },
  { id: 'notifications', label: 'Avisos', Icon: Bell },
  { id: 'profile', label: 'Perfil', Icon: User },
]

export default function Sidebar({ currentView, setCurrentView, onNewDose, unreadCount = 0 }) {
  return (
    <aside className="sidebar" aria-label="Menu lateral">
      <div className="sidebar-brand">
        <span className="sidebar-brand-title">Dosiq</span>
        <span className="sidebar-brand-subtitle">Santuário Terapêutico</span>
      </div>

      <nav className="sidebar-nav">
        {/* eslint-disable-next-line no-unused-vars */}
        {NAV_ITEMS.map(({ id, label, Icon }) => (
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

      <div className="sidebar-footer">
        <button className="sidebar-add-btn" onClick={onNewDose} aria-label="Registrar dose">
          <Plus size={18} aria-hidden="true" />
          <span>Registrar Dose</span>
        </button>
      </div>
    </aside>
  )
}
