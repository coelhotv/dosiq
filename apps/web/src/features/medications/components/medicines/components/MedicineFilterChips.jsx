export default function MedicineFilterChips({ filterType, onFilterChange }) {
  const filters = [
    { key: 'all', label: 'Todos' },
    { key: 'medicamento', label: 'Medicamentos' },
    { key: 'suplemento', label: 'Suplementos' },
  ]

  return (
    <div className="sr-medicines__filters">
      {filters.map(({ key, label }) => (
        <button
          key={key}
          className={`sr-filter-chip ${filterType === key ? 'sr-filter-chip--active' : ''}`}
          onClick={() => onFilterChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
