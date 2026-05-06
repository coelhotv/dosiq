import MedicineAutocomplete from '@medications/components/MedicineAutocomplete'
import LaboratoryAutocomplete from '@medications/components/LaboratoryAutocomplete'
import Button from '@shared/components/ui/Button'
import { DOSAGE_UNITS, REGULATORY_CATEGORIES, REGULATORY_CATEGORY_LABELS } from '@schemas/medicineSchema'

export default function TreatmentWizardStep1({
  medicines,
  medicineMode,
  setMedicineMode,
  selectedExistingMedicine,
  setSelectedExistingMedicine,
  medicineData,
  updateMedicine,
  handleMedicineSelect,
  handleLaboratorySelect,
  onCancel,
  goNext,
  isMedicineValid,
}) {
  return (
    <div className="wizard__step">
      <h3 className="wizard__title">Medicamento</h3>

      {medicines.length > 0 && (
        <div className="wizard__mode-toggle">
          <button
            type="button"
            className={`wizard__mode-btn${medicineMode === 'existing' ? ' wizard__mode-btn--active' : ''}`}
            onClick={() => {
              setMedicineMode('existing')
              setSelectedExistingMedicine(null)
            }}
          >
            Já cadastrado
          </button>
          <button
            type="button"
            className={`wizard__mode-btn${medicineMode === 'new' ? ' wizard__mode-btn--active' : ''}`}
            onClick={() => {
              setMedicineMode('new')
              setSelectedExistingMedicine(null)
            }}
          >
            Novo medicamento
          </button>
        </div>
      )}

      {medicineMode === 'existing' ? (
        <label className="wizard__label">
          Selecionar medicamento
          <select
            className="wizard__select"
            value={selectedExistingMedicine?.id || ''}
            onChange={(e) => {
              const med = medicines.find((m) => m.id === e.target.value)
              setSelectedExistingMedicine(med || null)
            }}
          >
            <option value="">-- Escolha um medicamento --</option>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.dosage_per_pill ? ` ${m.dosage_per_pill}${m.dosage_unit}` : ''}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="wizard__label">
            Nome *
            <MedicineAutocomplete
              value={medicineData.name}
              onChange={(value) => updateMedicine('name', value)}
              onSelect={handleMedicineSelect}
              placeholder="Ex: Losartana ou busque na base ANVISA..."
            />
          </label>

          <label className="wizard__label">
            Tipo
            <select
              className="wizard__select"
              value={medicineData.type}
              onChange={(e) => updateMedicine('type', e.target.value)}
            >
              <option value="medicamento">Medicamento</option>
              <option value="suplemento">Suplemento</option>
            </select>
          </label>

          <label className="wizard__label">
            Marca / Laboratório
            <LaboratoryAutocomplete
              value={medicineData.laboratory}
              onChange={(value) => updateMedicine('laboratory', value)}
              onSelect={handleLaboratorySelect}
              placeholder="Ex: EMS, Medley..."
            />
          </label>

          {medicineData.active_ingredient && (
            <label className="wizard__label">
              Princípio Ativo
              <input
                type="text"
                className="wizard__input"
                value={medicineData.active_ingredient}
                readOnly
              />
              <small className="wizard__label-note">
                Preenchido automaticamente via ANVISA
              </small>
            </label>
          )}

          {medicineData.therapeutic_class && (
            <label className="wizard__label">
              Classe Terapêutica
              <input
                type="text"
                className="wizard__input"
                value={medicineData.therapeutic_class}
                onChange={(e) => updateMedicine('therapeutic_class', e.target.value)}
                maxLength={100}
              />
              <small className="wizard__label-note">
                Preenchido automaticamente via ANVISA
              </small>
            </label>
          )}

          <label className="wizard__label">
            Categoria Regulatória
            <select
              className="wizard__select"
              value={medicineData.regulatory_category || ''}
              onChange={(e) => updateMedicine('regulatory_category', e.target.value || null)}
            >
              <option value="">Selecione (opcional)</option>
              {REGULATORY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {REGULATORY_CATEGORY_LABELS[category] || category}
                </option>
              ))}
            </select>
            <small className="wizard__label-note">
              Preenchido automaticamente via ANVISA quando disponível.
            </small>
          </label>

          <div className="wizard__row">
            <label className="wizard__label" style={{ flex: 1 }}>
              Dosagem *
              <input
                type="number"
                className="wizard__input"
                value={medicineData.dosage_per_pill}
                onChange={(e) => updateMedicine('dosage_per_pill', e.target.value)}
                placeholder="50"
                min="0"
                step="any"
              />
            </label>
            <label className="wizard__label" style={{ width: 100 }}>
              Unidade
              <select
                className="wizard__select"
                value={medicineData.dosage_unit}
                onChange={(e) => updateMedicine('dosage_unit', e.target.value)}
              >
                {DOSAGE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      <div className="wizard__actions">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={goNext} disabled={!isMedicineValid}>
          Próximo →
        </Button>
      </div>
    </div>
  )
}
