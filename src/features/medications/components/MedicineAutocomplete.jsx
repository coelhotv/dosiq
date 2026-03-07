import { searchMedicines } from '@medications/services/medicineDatabaseService'
import GenericAutocomplete from './GenericAutocomplete'

/**
 * Componente de autocomplete para medicamentos ANVISA.
 *
 * Props:
 * - value: string — valor do input
 * - onChange: (value) => void — callback ao digitar
 * - onSelect: (medicine) => void — callback ao selecionar
 * - placeholder: string (default: "Digite o nome do medicamento...")
 * - disabled: boolean (default: false)
 */
export default function MedicineAutocomplete({
  value = '',
  onChange,
  onSelect,
  placeholder,
  disabled = false,
}) {
  const renderSuggestion = (medicine) => (
    <>
      <div className="autocomplete-item-name">{medicine.name}</div>
      <div className="autocomplete-item-subtitle">
        {medicine.activeIngredient}
        {medicine.therapeuticClass && ` • ${medicine.therapeuticClass}`}
      </div>
    </>
  )

  return (
    <GenericAutocomplete
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      searchFn={searchMedicines}
      renderSuggestion={renderSuggestion}
      placeholder={placeholder || 'Digite o nome do medicamento (mín. 3 caracteres)...'}
      disabled={disabled}
      dropdownId="medicine-dropdown"
    />
  )
}
