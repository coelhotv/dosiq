import { searchLaboratories } from '@medications/services/laboratoryDatabaseService'
import GenericAutocomplete from './GenericAutocomplete'

/**
 * Componente de autocomplete para laboratórios ANVISA.
 *
 * Props:
 * - value: string — valor do input
 * - onChange: (value) => void — callback ao digitar
 * - onSelect: (laboratory) => void — callback ao selecionar
 * - placeholder: string (default: "Digite o nome do laboratório...")
 * - disabled: boolean (default: false)
 */
export default function LaboratoryAutocomplete({ value = '', onChange, onSelect, placeholder, disabled = false }) {
  const renderSuggestion = (laboratory) => (
    <div className="autocomplete-item-name">{laboratory.laboratory}</div>
  )

  return (
    <GenericAutocomplete
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      searchFn={searchLaboratories}
      renderSuggestion={renderSuggestion}
      placeholder={placeholder || 'Digite o nome do laboratório (mín. 3 caracteres)...'}
      disabled={disabled}
      dropdownId="laboratory-dropdown"
    />
  )
}
