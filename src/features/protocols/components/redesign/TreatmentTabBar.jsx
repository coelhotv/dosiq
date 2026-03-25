/**
 * TreatmentTabBar — Segmented control com tabs Ativos/Pausados/Finalizados
 * Exibe contadores para cada tab
 */
const TABS = [
  { key: 'ativos', label: 'Ativos' },
  { key: 'pausados', label: 'Pausados' },
  { key: 'finalizados', label: 'Finalizados' },
]

export default function TreatmentTabBar({ activeTab, counts, onChange }) {
  return (
    <div className="treatment-tab-bar" role="tablist">
      {TABS.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`treatment-tab-bar__tab${activeTab === tab.key ? ' treatment-tab-bar__tab--active' : ''}`}
          onClick={() => onChange(tab.key)}
          style={{ minHeight: '2.5rem' }}
        >
          {tab.label}
          {counts[tab.key] > 0 && (
            <span className="treatment-tab-bar__count">{counts[tab.key]}</span>
          )}
        </button>
      ))}
    </div>
  )
}
