import { Calendar, Pill, Package, User, Plus } from 'lucide-react'
import './Sidebar.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Hoje', Icon: Calendar },
  { id: 'treatment', label: 'Tratamentos', Icon: Pill },
  { id: 'stock', label: 'Estoque', Icon: Package },
  { id: 'profile', label: 'Perfil', Icon: User },
]

export default function Sidebar({ currentView, setCurrentView }) {
  return (
    <aside className="sidebar" aria-label="Menu lateral">
      <div className="sidebar-brand">
        <span className="sidebar-brand-title">Meus Remédios</span>
        <span className="sidebar-brand-subtitle">Santuário Terapêutico</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`sidebar-nav-item${currentView === id ? ' sidebar-nav-item--active' : ''}`}
            onClick={() => setCurrentView(id)}
            aria-current={currentView === id ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          className="sidebar-add-btn"
          onClick={() => setCurrentView('medicines')}
          aria-label="Adicionar medicamento"
        >
          <Plus size={18} aria-hidden="true" />
          <span>Adicionar Med.</span>
        </button>
      </div>
    </aside>
  )
}
