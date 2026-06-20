import { useState, useEffect, startTransition } from 'react'
import Button from '@shared/components/ui/Button'
import { formatDoseHint, isLiquidMedicine } from '@dosiq/core'
import './TitrationWizard.css'

/**
 * Hint de equivalência da dose da etapa ("✨ Equivale a 0,25 mg") via formatter
 * core (R-272). Sem medicine ou dose inválida → null (não renderiza ruído).
 */
function doseEquivalence(rawDosage, intakeUnit, medicine) {
  if (!medicine) return null
  const parsed = parseFloat(String(rawDosage ?? '').replace(',', '.'))
  if (Number.isNaN(parsed) || parsed <= 0) return null
  const hint = formatDoseHint(parsed, intakeUnit, medicine)
  return hint || null
}

/** Unidade de tomada exibida nos sufixos: líquido usa intake_unit; sólido "comp.". */
function intakeSuffix(intakeUnit, medicine) {
  if (medicine && isLiquidMedicine(medicine)) return intakeUnit || 'ml'
  return 'comp.'
}

function TitrationStageCard({
  stage,
  index,
  suffix,
  medicine,
  intakeUnit,
  handleUpdateStage,
  handleDosageBlur,
  handleRemoveStage,
}) {
  const stageHint = doseEquivalence(stage.dosage, intakeUnit, medicine)
  return (
    <div className="titration-stage-card">
      <div className="stage-number">Etapa {index + 1}</div>

      <div className="stage-grid">
        <div className="form-group-mini">
          <label>Duração</label>
          <div className="input-with-suffix">
            <input
              type="number"
              min="1"
              value={stage.duration_days ?? stage.days ?? ''}
              onChange={(e) => handleUpdateStage(index, 'duration_days', parseInt(e.target.value))}
            />
            <span>dias</span>
          </div>
        </div>

        <div className="form-group-mini">
          <label>Dose por tomada</label>
          <div className="input-with-suffix">
            <input
              type="text"
              inputMode="decimal"
              value={stage.dosage}
              onChange={(e) => handleUpdateStage(index, 'dosage', e.target.value)}
              onBlur={(e) => handleDosageBlur(index, e.target.value)}
            />
            <span>{suffix}</span>
          </div>
          {stageHint && <small className="dose-equivalence">✨ {stageHint}</small>}
        </div>

        <div className="form-group-mini full-width">
          <label>Nota / Objetivo</label>
          <input
            type="text"
            placeholder="Ex: Introdução, Aumento de dose..."
            value={stage.description ?? stage.note ?? ''}
            onChange={(e) => handleUpdateStage(index, 'description', e.target.value)}
          />
        </div>

        <div className="form-group-mini full-width">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={Boolean(stage.requires_new_medicine)}
              onChange={(e) =>
                handleUpdateStage(index, 'requires_new_medicine', e.target.checked)
              }
            />
            Esta etapa troca de medicamento/apresentação (ex.: nova caneta)
          </label>
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
  )
}

function AddStageForm({
  currentStage,
  setCurrentStage,
  suffix,
  currentHint,
  handleAddStage,
}) {
  return (
    <div className="add-stage-form">
      <h5>Nova Etapa</h5>
      <div className="stage-input-row">
        <div className="input-group">
          <label>Duração</label>
          <div className="input-with-suffix">
            <input
              type="number"
              min="1"
              value={currentStage.duration_days}
              onChange={(e) =>
                setCurrentStage((prev) => ({ ...prev, duration_days: parseInt(e.target.value) }))
              }
            />
            <span>dias</span>
          </div>
        </div>

        <div className="input-group">
          <label>Dose por tomada</label>
          <div className="input-with-suffix">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Ex: 0,25"
              value={currentStage.dosage}
              onChange={(e) =>
                setCurrentStage((prev) => ({ ...prev, dosage: e.target.value }))
              }
            />
            <span>{suffix}</span>
          </div>
          {currentHint && <small className="dose-equivalence">✨ {currentHint}</small>}
        </div>
      </div>

      <div className="input-group">
        <input
          type="text"
          placeholder="Nota (opcional) — Ex: Introdução, Aumento de dose..."
          value={currentStage.description}
          onChange={(e) => setCurrentStage((prev) => ({ ...prev, description: e.target.value }))}
          className="input-note"
        />
      </div>

      <div className="input-group">
        <label className="checkbox-inline">
          <input
            type="checkbox"
            checked={Boolean(currentStage.requires_new_medicine)}
            onChange={(e) =>
              setCurrentStage((prev) => ({ ...prev, requires_new_medicine: e.target.checked }))
            }
          />
          Esta etapa troca de medicamento/apresentação (ex.: nova caneta)
        </label>
      </div>

      <Button type="button" variant="outline" onClick={handleAddStage} className="btn-add-stage">
        ✓ Gravar Etapa
      </Button>
    </div>
  )
}

export default function TitrationWizard({ schedule = [], onChange, medicine = null, intakeUnit = null }) {
  const [stages, setStages] = useState(schedule)
  // Form state for a stage
  // Shape canônico do titrationStageSchema (Zod): duration_days/dosage/description.
  // O wizard legado gravava days/note — nunca passava na validação (regressão T008).
  const [currentStage, setCurrentStage] = useState({
    duration_days: 7,
    dosage: 1,
    description: '',
    requires_new_medicine: false,
  })

  useEffect(() => {
    startTransition(() => {
      setStages(schedule)
    })
  }, [schedule])

  const handleAddStage = () => {
    // R-270: normaliza a dose digitada com vírgula antes de persistir no estado
    const dosage = parseFloat(String(currentStage.dosage ?? '').replace(',', '.'))
    if (Number.isNaN(dosage) || dosage <= 0) return
    const newStages = [...stages, { ...currentStage, dosage }]
    setStages(newStages)
    onChange(newStages)
    // Reset form with previous values as convenience, but clear note + flag de troca
    setCurrentStage((prev) => ({ ...prev, description: '', requires_new_medicine: false }))
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

  // R-270 (012 Fase B): dose decimal aceita vírgula PT-BR ("0,25" → 0.25).
  // Input text+inputMode decimal — o type=number nativo rejeita vírgula. Digitação
  // mantém o texto cru (senão "0," vira 0 no meio da digitação); normaliza no blur.
  // Desmame/titulação: 0 é dose de negócio válida (etapa de pausa) → parsed >= 0.
  const handleDosageBlur = (index, raw) => {
    const parsed = parseFloat(String(raw ?? '').replace(',', '.'))
    if (!Number.isNaN(parsed) && parsed >= 0) handleUpdateStage(index, 'dosage', parsed)
    else handleUpdateStage(index, 'dosage', '')
  }

  const suffix = intakeSuffix(intakeUnit, medicine)
  const currentHint = doseEquivalence(currentStage.dosage, intakeUnit, medicine)
  const totalDays = stages.reduce((acc, stage) => acc + parseInt(stage.duration_days ?? stage.days ?? 0), 0)

  return (
    <div className="titration-wizard">
      <div className="wizard-header">
        <h4>📈 Regime de Titulação</h4>
        <p className="wizard-subtitle">
          Defina a evolução da dose ao longo do tempo, conforme a prescrição médica.
        </p>
      </div>

      <div className="stages-list">
        {stages.map((stage, index) => (
          <TitrationStageCard
            key={index}
            stage={stage}
            index={index}
            suffix={suffix}
            medicine={medicine}
            intakeUnit={intakeUnit}
            handleUpdateStage={handleUpdateStage}
            handleDosageBlur={handleDosageBlur}
            handleRemoveStage={handleRemoveStage}
          />
        ))}
      </div>

      <AddStageForm
        currentStage={currentStage}
        setCurrentStage={setCurrentStage}
        suffix={suffix}
        currentHint={currentHint}
        handleAddStage={handleAddStage}
      />

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
