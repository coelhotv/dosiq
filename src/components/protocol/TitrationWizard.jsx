import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import './TitrationWizard.css'

export default function TitrationWizard({ schedule = [], onChange }) {
  const [stages, setStages] = useState(schedule)
  // Form state for a stage
  const [currentStage, setCurrentStage] = useState({
    days: 7,
    dosage: 1,
    note: '',
  })

  useEffect(() => {
    setStages(schedule)
  }, [schedule])

  const handleAddStage = () => {
    const newStages = [...stages, { ...currentStage }]
    setStages(newStages)
    onChange(newStages)
    // Reset form with previous values as convenience, but clear note
    setCurrentStage((prev) => ({ ...prev, note: '' }))
  }

  const handleRemoveStage = (index) => {
    const newStages = stages.filter((_, i) => i !== index)
    setStages(newStages)
    onChange(newStages)
  }

  const handleUpdateStage = (index, field, value) => {
    const newStages = [...stages]
    newStages[index] = { ...newStages[index], [field]: value }
    setStages(newStages)
    onChange(newStages)
  }

  const totalDays = stages.reduce((acc, stage) => acc + parseInt(stage.days || 0), 0)

  return (
    <div className="titration-wizard">
      <div className="wizard-header">
        <h4>📈 Regime de Titulação</h4>
        <p className="wizard-subtitle">Defina a evolução da dose ao longo do tempo.</p>
      </div>

      <div className="stages-list">
        {stages.map((stage, index) => (
          <div key={index} className="titration-stage-card">
            <div className="stage-number">Etapa {index + 1}</div>

            <div className="stage-grid">
              <div className="form-group-mini">
                <label>Duração (dias)</label>
                <input
                  type="number"
                  min="1"
                  value={stage.days}
                  onChange={(e) => handleUpdateStage(index, 'days', parseInt(e.target.value))}
                />
              </div>

              <div className="form-group-mini">
                <label>Dose (comps)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={stage.dosage}
                  onChange={(e) => handleUpdateStage(index, 'dosage', parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group-mini full-width">
                <label>Nota / Objetivo</label>
                <input
                  type="text"
                  placeholder="Ex: Introdução, Aumento de dose..."
                  value={stage.note}
                  onChange={(e) => handleUpdateStage(index, 'note', e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn-remove-stage"
              onClick={() => handleRemoveStage(index)}
              title="Remover etapa"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <div className="add-stage-form">
        <h5>Adicionar Nova Etapa</h5>
        <div className="stage-input-row">
          <div className="input-group">
            <label>Duração</label>
            <div className="input-with-suffix">
              <input
                type="number"
                min="1"
                value={currentStage.days}
                onChange={(e) =>
                  setCurrentStage((prev) => ({ ...prev, days: parseInt(e.target.value) }))
                }
              />
              <span>dias</span>
            </div>
          </div>

          <div className="input-group">
            <label>Dose</label>
            <div className="input-with-suffix">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={currentStage.dosage}
                onChange={(e) =>
                  setCurrentStage((prev) => ({ ...prev, dosage: parseFloat(e.target.value) }))
                }
              />
              <span>comp.</span>
            </div>
          </div>
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Nota (opcional)"
            value={currentStage.note}
            onChange={(e) => setCurrentStage((prev) => ({ ...prev, note: e.target.value }))}
            className="input-note"
          />
        </div>

        <Button type="button" variant="outline" onClick={handleAddStage} className="btn-add-stage">
          ➕ Adicionar Etapa
        </Button>
      </div>

      {stages.length > 0 && (
        <div className="titration-summary">
          <span>
            ⏱️ Tempo total previsto: <strong>{totalDays} dias</strong> até a manutenção.
          </span>
        </div>
      )}
    </div>
  )
}
