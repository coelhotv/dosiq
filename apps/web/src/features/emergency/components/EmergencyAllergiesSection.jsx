/**
 * EmergencyAllergiesSection — Seção de alergias do EmergencyCardForm.
 */
import Button from '@shared/components/ui/Button'
import Card from '@shared/components/ui/Card'
import { TriangleAlert } from 'lucide-react'

export default function EmergencyAllergiesSection({
  allergies,
  allergyInput,
  onAllergyInputChange,
  onAddAllergy,
  onRemoveAllergy,
  onKeyDown,
}) {
  return (
    <Card className="emergency-card-section" hover={false}>
      <h3 className="section-title"><TriangleAlert size={22} /> Alergias</h3>
      <p className="section-description">
        Liste suas alergias conhecidas (até 20). Isso é crucial para tratamento de emergência.
      </p>

      <div className="allergy-input-container">
        <input
          type="text"
          value={allergyInput}
          onChange={onAllergyInputChange}
          onKeyDown={onKeyDown}
          placeholder="Digite uma alergia"
          maxLength={200}
          className="allergy-input"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddAllergy}
          disabled={!allergyInput.trim() || allergies.length >= 20}
        >
          Adicionar
        </Button>
      </div>

      {allergies.length > 0 && (
        <div className="allergy-tags">
          {allergies.map((allergy, index) => (
            <span key={index} className="allergy-tag">
              {allergy}
              <button
                type="button"
                className="allergy-tag-remove"
                onClick={() => onRemoveAllergy(allergy)}
                aria-label={`Remover alergia ${allergy}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {allergies.length === 0 && <p className="empty-state">Nenhuma alergia cadastrada</p>}
    </Card>
  )
}
