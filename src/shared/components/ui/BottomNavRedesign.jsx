import { Calendar, Pill, Package, User } from 'lucide-react'
import './BottomNavRedesign.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Hoje', Icon: Calendar },
  { id: 'treatment', label: 'Tratamento', Icon: Pill },
  { id: 'stock', label: 'Estoque', Icon: Package },
  { id: 'profile', label: 'Perfil', Icon: User },
]

export default function BottomNavRedesign({ currentView, setCurrentView }) {
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
            aria-label={label}
          >
            <Icon size={28} aria-hidden="true" />
            <span className="bnr-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
