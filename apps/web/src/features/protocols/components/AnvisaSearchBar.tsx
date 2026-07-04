/**
 * AnvisaSearchBar — Busca inline na base ANVISA com smart routing
 *
 * Click em resultado:
 * - Se medicina tem protocolo → abre form de edição via onEditProtocol
 * - Se não tem protocolo → abre TreatmentWizard para criar novo
 */
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import MedicineAutocomplete from '@medications/components/MedicineAutocomplete'
import { formatSelectedMedicine } from '@medications/components/_medicineFormUtils'

export default function AnvisaSearchBar({
  existingProtocols,
  onNavigateToProtocol, // Deprecated — mantido por compatibilidade retroativa
  onEditProtocol, // Novo: callback para editar protocolo existente
  onOpenWizard,
  onViewAllMedicines, // Novo: link "todos medicamentos" abaixo da busca
}: any) {
  const [query, setQuery] = useState('')

  /**
   * Lidar com seleção de medicamento da base ANVISA
   * anvisaMedicine = { name, activeIngredient, therapeuticClass, ... }
   *
   * Fluxo:
   * 1. Buscar se medicamento já tem protocolo associado (match por nome)
   * 2. Se tem → chamar onEditProtocol(match) para editar
   * 3. Se não tem → chamar onOpenWizard com dados em Title Case
   */
  function handleSelect(anvisaMedicine) {
    // Verificar se já existe protocolo para este medicamento (match por nome, case-insensitive)
    const match = existingProtocols.find(
      (item) => item.medicineName.toLowerCase() === anvisaMedicine.name.toLowerCase()
    )

    if (match) {
      // Protocolo existente → abrir form de edição
      if (onEditProtocol) {
        onEditProtocol(match)
      } else if (onNavigateToProtocol) {
        // Fallback para compatibilidade retroativa (deprecated)
        onNavigateToProtocol(match)
      }
    } else {
      // Sem protocolo → abrir TreatmentWizard com medicamento pré-selecionado.
      // Reusa o mapper canônico do form de medicines (formatSelectedMedicine) p/
      // paridade total — inclui `laboratory` e `regulatory_category` (normalizado),
      // que o mapeamento parcial anterior omitia (lab vazio no wizard p/ não-genéricos).
      onOpenWizard(formatSelectedMedicine(anvisaMedicine))
    }

    setQuery('')
  }

  return (
    <div className="anvisa-search-bar">
      <MedicineAutocomplete
        value={query}
        onChange={setQuery}
        onSelect={handleSelect}
        placeholder="Buscar na base ANVISA..."
        inputId="anvisa-search-input"
        ariaDescribedBy={undefined}
      />
      {onViewAllMedicines && (
        <button className="anvisa-search__view-all" onClick={onViewAllMedicines}>
          todos medicamentos
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  )
}
